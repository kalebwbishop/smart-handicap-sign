"""Auth middleware — thin re-export from the shared deploy-box auth package.

All route files and tests import ``CurrentUser``, ``get_current_user``, and
``optional_auth`` from this module.  By keeping this file as the import
surface we avoid touching every consumer.
"""

from deploy_box.auth import CurrentUser  # noqa: F401 — re-export

from app.config.auth import build_auth_dependencies

get_current_user, optional_auth = build_auth_dependencies()
