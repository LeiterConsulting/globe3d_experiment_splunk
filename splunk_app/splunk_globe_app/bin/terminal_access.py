import json
import socket
import time
from urllib.parse import parse_qs

import splunk.rest as rest
from splunk.persistconn.application import PersistentServerConnectionApplication

APP = 'splunk_globe_app'
DEFAULT_TIMEOUT_S = 3


def _json_response(payload, status=200):
    return {
        'status': status,
        'payload': json.dumps(payload),
        'headers': {'Content-Type': 'application/json'},
    }


def _to_bool(raw, default=False):
    s = str(raw if raw is not None else '').strip().lower()
    if not s:
        return default
    return s in ('1', 'true', 'yes', 'on')


def _to_int(raw, default):
    try:
        return int(raw)
    except Exception:
        return default


def _get_session_key(req):
    sess = req.get('session', {}) if isinstance(req, dict) else {}
    if isinstance(sess, dict):
        sk = sess.get('authtoken') or sess.get('sessionKey') or sess.get('session_key') or sess.get('splunk.sessionKey')
        if sk and isinstance(sk, str):
            return sk

    for key in ('sessionKey', 'session_key'):
        if isinstance(req.get(key), str) and req.get(key):
            return req.get(key)

    headers = req.get('headers') or {}
    if isinstance(headers, dict):
        auth = headers.get('Authorization') or headers.get('authorization') or ''
        if isinstance(auth, str) and auth.startswith('Splunk '):
            token = auth[7:].strip()
            if token:
                return token

    return None


def _normalize_path(req):
    path = req.get('path_info') or req.get('path') or req.get('uri') or req.get('rest_path') or ''
    if isinstance(path, (bytes, bytearray)):
        path = path.decode('utf-8', errors='replace')
    if not isinstance(path, str):
        path = str(path)
    if '?' in path:
        path = path.split('?', 1)[0]
    return path.rstrip('/')


def _simple_json(path, session_key, method='GET', getargs=None, postargs=None):
    response, content = rest.simpleRequest(
        path,
        sessionKey=session_key,
        method=method,
        getargs=getargs or {},
        postargs=postargs or {},
        raiseAllErrors=True,
    )
    body = content.decode('utf-8') if isinstance(content, (bytes, bytearray)) else str(content)
    return json.loads(body) if body else {}


def _parse_params(req):
    raw_payload = req.get('payload')
    if isinstance(raw_payload, (bytes, bytearray)):
        raw_payload = raw_payload.decode('utf-8', errors='replace')

    body = None
    if isinstance(raw_payload, str) and raw_payload.strip():
        try:
            body = json.loads(raw_payload)
        except Exception:
            body = None
    elif isinstance(raw_payload, dict):
        body = raw_payload

    params = {}
    if isinstance(body, dict):
        params.update(body)

    if isinstance(raw_payload, str) and raw_payload.strip() and not isinstance(body, dict):
        try:
            parsed = parse_qs(raw_payload, keep_blank_values=True)
            for key, values in parsed.items():
                if values:
                    params[key] = values[0]
        except Exception:
            pass

    for key in ('form', 'postargs', 'body', 'query', 'getargs'):
        value = req.get(key)
        if isinstance(value, dict):
            params.update(value)

    return params


def _read_terminal_settings(session_key):
    try:
        data = _simple_json(
            '/servicesNS/nobody/{}/configs/conf-terminal_app/settings'.format(APP),
            session_key,
            method='GET',
            getargs={'output_mode': 'json'},
        )
        entry = (data.get('entry') or [{}])[0]
        return entry.get('content') or {}
    except Exception:
        return {}


def _load_known_endpoints(session_key):
    try:
        data = _simple_json(
            '/servicesNS/nobody/{}/configs/conf-terminal_assets'.format(APP),
            session_key,
            method='GET',
            getargs={'output_mode': 'json', 'count': '0'},
        )
    except Exception:
        return []

    result = []
    for entry in data.get('entry') or []:
        name = str(entry.get('name') or '')
        if not name.startswith('endpoint:'):
            continue
        content = entry.get('content') or {}
        endpoint_id = name.split(':', 1)[1]
        host = str(content.get('host') or '').strip()
        if not host:
            continue
        port = _to_int(content.get('port'), 22)
        enabled = _to_bool(content.get('enabled'), True)
        description = str(content.get('description') or '').strip()
        tags = [t.strip() for t in str(content.get('tags') or '').split(',') if t.strip()]
        result.append(
            {
                'id': endpoint_id,
                'host': host,
                'port': port,
                'description': description,
                'enabled': enabled,
                'tags': tags,
            }
        )

    return [x for x in result if x.get('enabled')]


def _get_current_context(session_key):
    data = _simple_json(
        '/services/authentication/current-context',
        session_key,
        method='GET',
        getargs={'output_mode': 'json'},
    )
    entry = (data.get('entry') or [{}])[0]
    content = entry.get('content') or {}
    username = str(content.get('username') or content.get('realname') or '')

    capabilities = content.get('capabilities') or []
    if isinstance(capabilities, str):
        capabilities = [x.strip() for x in capabilities.split(',') if x.strip()]
    elif not isinstance(capabilities, list):
        capabilities = []
    return username, [str(x) for x in capabilities]


def _dns_probe(host):
    started = time.time()
    try:
        socket.getaddrinfo(host, None)
        return {'ok': True, 'detail': 'DNS resolve ok', 'ms': int((time.time() - started) * 1000)}
    except Exception as e:
        return {'ok': False, 'detail': 'DNS resolve failed: {}'.format(e), 'ms': int((time.time() - started) * 1000)}


def _tcp_probe(host, port, timeout_s):
    started = time.time()
    s = None
    try:
        s = socket.create_connection((host, port), timeout=timeout_s)
        return {'ok': True, 'detail': 'TCP connect ok', 'ms': int((time.time() - started) * 1000)}
    except Exception as e:
        return {'ok': False, 'detail': 'TCP connect failed: {}'.format(e), 'ms': int((time.time() - started) * 1000)}
    finally:
        if s:
            try:
                s.close()
            except Exception:
                pass


def _ssh_banner_probe(host, port, timeout_s):
    started = time.time()
    s = None
    try:
        s = socket.create_connection((host, port), timeout=timeout_s)
        s.settimeout(timeout_s)
        banner = s.recv(256)
        text = banner.decode('utf-8', errors='replace').strip()
        if text.startswith('SSH-'):
            return {'ok': True, 'detail': 'SSH banner received: {}'.format(text[:100]), 'ms': int((time.time() - started) * 1000)}
        if text:
            return {'ok': False, 'detail': 'Non-SSH banner: {}'.format(text[:100]), 'ms': int((time.time() - started) * 1000)}
        return {'ok': False, 'detail': 'No banner received', 'ms': int((time.time() - started) * 1000)}
    except Exception as e:
        return {'ok': False, 'detail': 'SSH banner probe failed: {}'.format(e), 'ms': int((time.time() - started) * 1000)}
    finally:
        if s:
            try:
                s.close()
            except Exception:
                pass


def _run_probe(host, port, timeout_s):
    return {
        'endpoint_id': '{}:{}'.format(host, port),
        'host': host,
        'port': port,
        'probes': {
            'dns': _dns_probe(host),
            'tcp': _tcp_probe(host, port, timeout_s),
            'ssh_banner': _ssh_banner_probe(host, port, timeout_s),
        },
    }


def _build_launch_url(template, host, port, user):
    t = (template or '').strip()
    if not t:
        return None
    return t.replace('{host}', host).replace('{port}', str(port)).replace('{user}', user or '')


class TerminalAccessApp(PersistentServerConnectionApplication):
    def __init__(self, command_line=None, command_arg=None):
        super(TerminalAccessApp, self).__init__()

    def handle(self, in_string):
        try:
            req = json.loads(in_string) if in_string else {}
            session_key = _get_session_key(req)
            if not session_key:
                return _json_response({'error': 'Missing session key'}, status=401)

            method = str(req.get('method') or 'GET').upper()
            path = _normalize_path(req)
            params = _parse_params(req)

            settings = _read_terminal_settings(session_key)
            required_capability = str(settings.get('required_capability') or 'terminal_remote_access').strip() or 'terminal_remote_access'
            timeout_s = max(1, min(15, _to_int(settings.get('probe_timeout_s'), DEFAULT_TIMEOUT_S)))

            user, capabilities = _get_current_context(session_key)
            has_access = required_capability in capabilities

            if path.endswith('/ping'):
                return _json_response({'ok': True, 'path': path, 'method': method})

            if path.endswith('/capability'):
                return _json_response(
                    {
                        'ok': True,
                        'user': user,
                        'required_capability': required_capability,
                        'has_access': has_access,
                        'capabilities': capabilities,
                    }
                )

            if path.endswith('/endpoints'):
                endpoints = _load_known_endpoints(session_key)
                if _to_bool(params.get('probe'), False):
                    probes = []
                    for ep in endpoints:
                        p = _run_probe(ep['host'], ep['port'], timeout_s)
                        p['endpoint_id'] = ep['id']
                        probes.append(p)
                    return _json_response({'ok': True, 'endpoints': endpoints, 'probes': probes})
                return _json_response({'ok': True, 'endpoints': endpoints})

            if path.endswith('/probe'):
                host = str(params.get('host') or '').strip()
                port = _to_int(params.get('port'), 22)
                if not host:
                    return _json_response({'error': 'host is required'}, status=400)
                if port < 1 or port > 65535:
                    return _json_response({'error': 'port must be between 1 and 65535'}, status=400)
                probe = _run_probe(host, port, timeout_s)
                return _json_response(probe)

            if path.endswith('/connect'):
                if not has_access:
                    return _json_response(
                        {
                            'ok': False,
                            'can_connect': False,
                            'reason': 'Missing capability {}'.format(required_capability),
                        },
                        status=403,
                    )

                host = str(params.get('host') or '').strip()
                port = _to_int(params.get('port'), 22)
                if not host:
                    return _json_response({'error': 'host is required'}, status=400)
                if port < 1 or port > 65535:
                    return _json_response({'error': 'port must be between 1 and 65535'}, status=400)

                probe = _run_probe(host, port, timeout_s)
                tcp_ok = probe['probes']['tcp']['ok']
                ssh_ok = probe['probes']['ssh_banner']['ok']
                if not (tcp_ok and ssh_ok):
                    return _json_response(
                        {
                            'ok': False,
                            'can_connect': False,
                            'reason': 'Probe failed. TCP and SSH banner checks must pass before connect.',
                            'probe': probe,
                        },
                        status=409,
                    )

                launch_url = _build_launch_url(settings.get('terminal_gateway_url_template'), host, port, user)
                connection = {
                    'type': 'ssh',
                    'host': host,
                    'port': port,
                    'user': user,
                    'ssh_uri': 'ssh://{}@{}:{}'.format(user or 'user', host, port),
                    'launch': {
                        'kind': 'web-terminal-url' if launch_url else 'external-ssh-client',
                        'url': launch_url,
                        'note': 'Configure terminal_gateway_url_template in terminal_app.conf for in-browser launch.' if not launch_url else '',
                    },
                }
                return _json_response({'ok': True, 'can_connect': True, 'connection': connection, 'probe': probe})

            return _json_response({'error': 'Unknown path {}'.format(path)}, status=404)
        except Exception as e:
            return _json_response({'error': str(e)}, status=500)
