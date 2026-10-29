import hashlib
import hmac
import secrets


class OpaqueTokens:
    def issue(self) -> str:
        return secrets.token_urlsafe(32)

    def digest(self, raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    def csrf(self, raw: str) -> str:
        return hmac.new(raw.encode(), b"tasktracker:csrf:v1", hashlib.sha256).hexdigest()

    def valid_csrf(self, raw: str, supplied: str) -> bool:
        return (
            len(supplied) == 64
            and supplied.isascii()
            and hmac.compare_digest(self.csrf(raw), supplied)
        )
