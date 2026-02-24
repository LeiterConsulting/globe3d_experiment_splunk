import json

try:
  import cherrypy
except Exception:
  cherrypy = None

try:
  from splunk.appserver.mrsparkle.controllers import BaseController
except Exception:
  BaseController = object

try:
  from splunk.appserver.mrsparkle.lib.decorators import expose_page
except Exception:
  def expose_page(*_args, **_kwargs):
    def _wrap(fn):
      return fn
    return _wrap

try:
  from urllib.parse import parse_qs
except Exception:
  from urlparse import parse_qs

APP = 'splunk_globe_app_v2'


def _json_response(payload, status=200):
  if cherrypy is not None:
    cherrypy.response.status = status
    cherrypy.response.headers['Content-Type'] = 'application/json'
    cherrypy.response.headers['Cache-Control'] = 'no-store'
  return json.dumps(payload)


def _get_session_key():
  if cherrypy is None:
    return None
  try:
    sess = cherrypy.session
    if not sess:
      return None
    return (
      sess.get('sessionKey')
      or sess.get('session_key')
      or sess.get('authtoken')
      or sess.get('splunk.sessionKey')
    )
  except Exception:
    return None


def _parse_payload_and_params(kwargs):
  params = dict(kwargs or {})

  raw_body = None
  try:
    if cherrypy is not None:
      raw_body = cherrypy.request.body.read()
  except Exception:
    raw_body = None

  if raw_body:
    try:
      text = raw_body.decode('utf-8', errors='replace')
      if text.strip().startswith('{'):
        body = json.loads(text)
        if isinstance(body, dict):
          params.update(body)
      else:
        qs = parse_qs(text, keep_blank_values=True)
        for key, values in qs.items():
          if values:
            params.setdefault(key, values[0])
    except Exception:
      pass

  return params


def _proxy_simple_request(path, session_key, method, params):
  import splunk.rest as rest

  getargs = None
  postargs = None
  if method in ('GET', 'DELETE'):
    getargs = params
  else:
    postargs = params

  resp, content = rest.simpleRequest(
    path,
    sessionKey=session_key,
    method=method,
    getargs=getargs,
    postargs=postargs,
    raiseAllErrors=False,
  )

  status = 200
  try:
    status = int(resp.get('status') or 200)
  except Exception:
    status = 200

  headers = resp.get('headers') or {}
  content_type = headers.get('content-type') or headers.get('Content-Type') or 'application/json'

  if cherrypy is not None:
    cherrypy.response.status = status
    cherrypy.response.headers['Content-Type'] = content_type
    cherrypy.response.headers['Cache-Control'] = 'no-store'

  return content.decode('utf-8', errors='replace') if isinstance(content, (bytes, bytearray)) else (content or '')


class TerminalRestProxyController(BaseController):
  @expose_page(must_login=True)
  def ping(self, **_kwargs):
    sk = _get_session_key()
    return _json_response({'ok': True, 'app': APP, 'hasSessionKey': bool(sk)})

  @expose_page(must_login=True)
  def services(self, *args, **kwargs):
    sk = _get_session_key()
    if not sk:
      return _json_response({'error': 'Missing session key'}, status=401)

    if cherrypy is None:
      return _json_response({'error': 'cherrypy not available'}, status=500)

    method = cherrypy.request.method.upper()
    segments = [s for s in args if s]

    if not segments or segments[0] != APP:
      return _json_response({'error': 'Forbidden proxy target', 'allowedApp': APP}, status=403)

    params = _parse_payload_and_params(kwargs)
    target = '/services/' + '/'.join(segments)
    return _proxy_simple_request(target, sk, method, params)


class Terminal_rest_proxyController(TerminalRestProxyController):
  pass
