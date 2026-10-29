from anyio import CapacityLimiter, to_thread
from pwdlib import PasswordHash

# A public dummy hash provides the same expensive verification for unknown accounts.
_DUMMY = (
    "$argon2id$v=19$m=65536,t=3,p=4$wagCPXjifgvUFBzq4hqe3w$"
    "CYaIb8sB+wtD+Vu/P4uod1+Qof8h+1g7bbDlBID48Rc"
)


class ArgonPasswords:
    def __init__(self) -> None:
        self._hasher = PasswordHash.recommended()
        self._limiter = CapacityLimiter(2)

    async def hash(self, password: str) -> str:
        return await to_thread.run_sync(self._hasher.hash, password, limiter=self._limiter)

    async def verify(self, password: str, encoded: str | None) -> bool:
        valid = await to_thread.run_sync(
            self._hasher.verify,
            password,
            encoded or _DUMMY,
            limiter=self._limiter,
        )
        return valid and encoded is not None
