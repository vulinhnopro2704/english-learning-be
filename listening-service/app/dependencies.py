"""Authentication and authorization dependencies for Listening Service.

Validates trusted headers passed from API Gateway after JWT verification.
"""

from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from pydantic import BaseModel


class UserAuth(BaseModel):
    """Authenticated user context resolved from Gateway headers."""

    user_id: str
    role: str
    email: str


def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
    x_user_role: Optional[str] = Header(None, alias="x-user-role"),
    x_user_email: Optional[str] = Header(None, alias="x-user-email"),
) -> UserAuth:
    """Extract authenticated user identity forwarded by API Gateway (or guest context)."""
    return UserAuth(
        user_id=x_user_id or "guest",
        role=x_user_role or "user",
        email=x_user_email or "",
    )


def require_auth_user(
    user: UserAuth = Depends(get_current_user),
) -> UserAuth:
    """Enforce authenticated user context."""
    if user.user_id == "guest":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user


def require_admin_role(
    user: UserAuth = Depends(get_current_user),
) -> UserAuth:
    """Enforce Admin role authorization for video processing and importing.

    Raises:
        HTTPException 403: If user role is not admin.
    """
    if user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to process or import YouTube listening lessons.",
        )

    return user
