from ninja import Schema


class RegisterIn(Schema):
    email: str
    password: str
    full_name: str
    organization: str = ""


class LoginIn(Schema):
    email: str
    password: str


class RefreshIn(Schema):
    refresh: str


class UserOut(Schema):
    id: int
    email: str
    full_name: str
    organization: str


class TokenOut(Schema):
    access: str
    refresh: str
