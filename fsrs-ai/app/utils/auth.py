"""Auth helpers for extracting effective user identity from gateway headers."""

from uuid import UUID

from fastapi import HTTPException, Request, status


def resolve_user_id(request: Request, explicit_user_id: UUID | None) -> UUID:
    """Resolve effective user id from explicit param or gateway header.

    Rules:
    - If both explicit user_id and x-user-id header exist and mismatch -> 403.
    - If explicit user_id exists -> use it.
    - Else if x-user-id exists -> use it.
    - Else -> 422 (missing user identifier).
    """
    header_user_id_raw = request.headers.get("x-user-id")
    header_user_id: UUID | None = None

    if header_user_id_raw:
        try:
            header_user_id = UUID(header_user_id_raw)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid x-user-id header",
            ) from exc

    if explicit_user_id and header_user_id and explicit_user_id != header_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: user_id does not match authenticated user",
        )

    if explicit_user_id:
        return explicit_user_id

    if header_user_id:
        return header_user_id

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Missing user_id (query/body) or x-user-id header",
    )
