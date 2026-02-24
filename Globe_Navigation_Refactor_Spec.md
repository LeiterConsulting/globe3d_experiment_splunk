# 🌍 Globe Navigation Refactor Specification

**Project:** 3D Earth Visualization\
**Goal:** Replace single-orbit camera logic with adaptive, zoom-aware
navigation system\
**Target:** Improve close-range panning/rotation usability (continent →
city scale)

------------------------------------------------------------------------

# 1. Problem Statement

The current globe uses a single orbit-style camera controller that:

-   Rotates around Earth center at all zoom levels
-   Uses spherical math for all navigation distances
-   Produces awkward lateral movement when near surface
-   Feels unstable and unintuitive at city-level zoom

We need a **multi-mode navigation controller** that dynamically adapts
based on camera altitude and zoom level.

------------------------------------------------------------------------

# 2. Design Objective

Implement a **Navigation State Machine** that transitions between:

1.  **Global Orbit Mode** (continent scale)
2.  **Surface Pivot Orbit Mode** (country/state scale)
3.  **Local Tangent Plane Mode** (county/city scale)

Transitions must be smooth and not visually jarring.

------------------------------------------------------------------------

# 3. Architecture Overview

Create a new controller system:

NavigationStateMachine ├── GlobalOrbitController ├──
SurfaceOrbitController ├── LocalTangentController

Replace the existing monolithic orbit control system.

------------------------------------------------------------------------

# 4. Mode Definitions

------------------------------------------------------------------------

## 🌎 4.1 Global Orbit Mode

**Active When:**\
Camera altitude \> GLOBAL_THRESHOLD

**Behavior:** - Camera orbits Earth center - Zoom = radial distance from
Earth center - Rotation: free yaw - Tilt limited (0°--80°) - No planar
panning

------------------------------------------------------------------------

## 🌍 4.2 Surface Pivot Orbit Mode

**Active When:**\
MID_THRESHOLD \< altitude ≤ GLOBAL_THRESHOLD

**Behavior:** - Raycast from cursor to globe - Use hit point as dynamic
pivot - Rotate around pivot, not Earth center - Pan moves pivot along
globe surface arc - Zoom moves camera toward pivot

------------------------------------------------------------------------

## 🏙 4.3 Local Tangent Plane Mode

**Active When:**\
Altitude ≤ MID_THRESHOLD

**Behavior:** - Convert camera position to local ENU frame
(East-North-Up) - Treat region as flat plane - Pan = translate in
tangent plane - Rotation limited to yaw only - Tilt limited to 0°--30° -
No full orbit around center

------------------------------------------------------------------------

# 5. Transition Rules

Determine mode using:

if altitude \> GLOBAL_THRESHOLD: mode = GLOBAL elif altitude \>
MID_THRESHOLD: mode = SURFACE else: mode = LOCAL

Transitions must blend smoothly over \~200ms.

------------------------------------------------------------------------

# 6. Critical Improvements Required

## 6.1 Dynamic Rotation Speed Scaling

rotationSpeed = baseSpeed \* clamp(altitude / SCALE_FACTOR, min, max)

Close to surface → slower rotation.

## 6.2 Zoom Toward Cursor

On scroll: 1. Raycast to globe under cursor 2. Move camera toward that
hit point 3. Adjust pivot accordingly

## 6.3 Tilt Constraints by Mode

  Mode      Max Tilt
  --------- ----------
  Global    80°
  Surface   60°
  Local     30°

## 6.4 Auto-Horizon Stabilization

camera.up = surfaceNormal

------------------------------------------------------------------------

# 7. Floating Origin (Optional)

-   Recenter world around camera periodically
-   Maintain globe in double precision if supported
-   Offset scene origin to camera position

------------------------------------------------------------------------

# 8. Deliverables

Codex should:

1.  Extract current orbit logic into GlobalOrbitController
2.  Implement SurfaceOrbitController
3.  Implement LocalTangentController
4.  Create NavigationStateMachine
5.  Replace existing controller wiring
6.  Add configurable thresholds
7.  Ensure smooth transition blending
8.  Add altitude-scaled rotation speed
9.  Implement cursor-based zoom targeting

------------------------------------------------------------------------

# 9. Acceptance Criteria

Navigation must:

-   Feel stable at city-level zoom
-   No lateral slingshot motion near surface
-   No camera inversion
-   Smooth transitions between modes
-   Zoom toward cursor behavior

------------------------------------------------------------------------

# 10. Non-Goals

-   Do not change rendering pipeline
-   Do not alter data overlay system
-   Only refactor camera/navigation layer

------------------------------------------------------------------------

# 11. Performance Requirements

-   No additional per-frame allocations
-   Raycasting limited to user interaction events
-   No more than one raycast per frame during drag

------------------------------------------------------------------------

# 12. Testing Plan

Test at zoom levels:

-   Continental
-   National
-   State
-   County
-   City

Validate:

-   Pan responsiveness
-   Rotation smoothness
-   Cursor-based zoom accuracy
-   Horizon stability

------------------------------------------------------------------------

# End of Specification
