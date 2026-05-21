"""Política de senha unificada — usada por registro, reset e qualquer
caminho que troque/cadastre senha de cliente.

Antes deste módulo existirem duas políticas inconsistentes:

* `auth_service.register_user` exigia apenas `len >= 8` — permitia
  ``12345678``, ``password``, ``aaaaaaaa``.
* `password_reset_service` exigia comprimento + maiúscula + minúscula
  + número + símbolo — sensato, mas só aplicado no reset.

Resultado: um usuário criava conta com senha fraca no fluxo de
cadastro e nunca mais era forçado a fortalecer — só veria a política
real se um dia esquecesse a senha e fizesse reset.

Esta função fica como **único ponto** que decide "essa senha pode
existir?". Adicionar regras novas aqui afeta todos os caminhos
automaticamente. Não força usuários atuais a trocar a senha existente
(o backfill não rotaciona hashes); só aplica a senhas novas ou alteradas
a partir deste ponto.
"""

from __future__ import annotations

from app.core.errors import ValidationError

#: Comprimento mínimo. 10 é o sweet-spot — passa do 8 do NIST 800-63B
#: (que considera o mínimo "razoável") sem ficar agressivo a ponto de
#: levar usuário a anotar a senha no Post-it.
MIN_LENGTH = 10

#: Comprimento máximo. Limita ataques de DoS via senha gigante
#: (bcrypt/scrypt custam O(N) no hash de input).
MAX_LENGTH = 128

#: Top-100 senhas mais comuns segundo SecLists/HaveIBeenPwned. Mesmo que
#: o atacante tente brute-force, essas são as primeiras tentativas — se
#: bloquear elas, eleva o custo do ataque em ordens de magnitude. Lista
#: inline pra não depender de internet/arquivo externo em runtime.
COMMON_PASSWORDS = frozenset(
    p.lower()
    for p in (
        "123456", "password", "12345678", "qwerty", "123456789",
        "12345", "1234", "111111", "1234567", "dragon", "123123",
        "baseball", "abc123", "football", "monkey", "letmein",
        "696969", "shadow", "master", "666666", "qwertyuiop",
        "123321", "mustang", "1234567890", "michael", "654321",
        "superman", "1qaz2wsx", "7777777", "121212", "000000",
        "qazwsx", "123qwe", "killer", "trustno1", "jordan",
        "jennifer", "zxcvbnm", "asdfgh", "hunter", "buster",
        "soccer", "harley", "batman", "andrew", "tigger",
        "sunshine", "iloveyou", "2000", "charlie", "robert",
        "thomas", "hockey", "ranger", "daniel", "starwars",
        "klaster", "112233", "george", "computer", "michelle",
        "jessica", "pepper", "1111", "zxcvbn", "555555",
        "11111111", "131313", "freedom", "777777", "pass",
        "maggie", "159753", "aaaaaa", "ginger", "princess",
        "joshua", "cheese", "amanda", "summer", "love",
        "ashley", "nicole", "chelsea", "biteme", "matthew",
        "access", "yankees", "987654321", "dallas", "austin",
        "thunder", "taylor", "matrix", "minecraft", "senha",
        "senha123", "peticiona", "peticiona123", "advogado",
        "admin", "admin123", "administrator", "root", "toor",
        # Variantes comuns "fake-forte" que aparecem em listas de leak
        # recentes contra SaaS BR — atendem o requisito sintático
        # (maiúscula+min+num+símbolo+10 chars) mas são óbvias.
        "password123!", "password123", "password1!", "p@ssword123",
        "passw0rd!", "passw0rd1!", "passw0rd2024", "passw0rd2025",
        "qwerty123!", "qwerty1234", "qwerty@123",
        "admin@123", "admin@2024", "admin@2025", "admin@2026",
        "peticiona1!", "peticiona@123", "peticiona@2024",
        "peticiona@2025", "peticiona@2026", "peticiona123!",
        "advogado123!", "advogado@123",
        "abcdef1234", "letmein123!", "welcome123!", "welcome@123",
    )
)


def validate_password_strength(password: str, *, email: str | None = None) -> None:
    """Valida a força de uma senha. Estoura ``ValidationError`` ao falhar.

    Regras (todas obrigatórias):
      * Comprimento entre :data:`MIN_LENGTH` e :data:`MAX_LENGTH`
      * Ao menos 1 letra maiúscula, 1 minúscula, 1 dígito e 1 símbolo
      * Não pode ser uma das :data:`COMMON_PASSWORDS`
      * Não pode ser a parte local do e-mail (antes do ``@``), se informado

    O ``email`` é opcional pra evitar o cliente cadastrar
    ``andre@peticiona.app.br`` com senha ``andre`` — caminho favorito de
    quem testa credential stuffing.
    """
    if not isinstance(password, str):
        raise ValidationError("Senha inválida.")

    if len(password) < MIN_LENGTH:
        raise ValidationError(
            f"A senha precisa ter ao menos {MIN_LENGTH} caracteres."
        )
    if len(password) > MAX_LENGTH:
        raise ValidationError(
            f"A senha não pode passar de {MAX_LENGTH} caracteres."
        )

    checks = (
        (any(c.isupper() for c in password), "ao menos 1 letra maiúscula"),
        (any(c.islower() for c in password), "ao menos 1 letra minúscula"),
        (any(c.isdigit() for c in password), "ao menos 1 número"),
        (any(not c.isalnum() for c in password), "ao menos 1 símbolo"),
    )
    for ok, label in checks:
        if not ok:
            raise ValidationError(f"A senha precisa ter {label}.")

    lowered = password.lower()
    if lowered in COMMON_PASSWORDS:
        raise ValidationError(
            "Esta senha é muito comum e está em listas públicas de vazamentos. "
            "Escolha outra."
        )

    if email:
        local_part = email.split("@", 1)[0].strip().lower()
        if local_part and len(local_part) >= 3 and local_part in lowered:
            raise ValidationError(
                "A senha não pode conter a parte local do seu e-mail."
            )
