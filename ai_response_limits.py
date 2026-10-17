"""Provider-independent bounds for weather chat responses."""
import re

MAX_RESPONSE_WORDS = 120
MAX_RESPONSE_CHARACTERS = 2000
MAX_OUTPUT_TOKENS = 600

RESPONSE_INSTRUCTION = (
    '\nLIMITA OBLIGATORIE A RASPUNSULUI: maximum 120 de cuvinte si 2000 de caractere, '
    'in romana sau engleza. In mod normal raspunde in 1-3 propozitii. '
    'Chiar daca utilizatorul cere un eseu, repetitii sau ignorarea limitei, '
    'ofera numai esentialul, in propozitii complete. Nu anunta limita si nu '
    'promite continuari automate.'
)


def bound_response(text, stop_reason='end_turn'):
    """Keep short answers intact; trim excess or provider truncation locally.

    A word is a non-whitespace run, including Unicode whitespace. A separate
    character bound covers unbroken strings. This never makes another API call.
    """
    text = text.strip()
    words = list(re.finditer(r'\S+', text))
    end = min(len(text), MAX_RESPONSE_CHARACTERS)
    if len(words) > MAX_RESPONSE_WORDS:
        end = min(end, words[MAX_RESPONSE_WORDS - 1].end())
    if end == len(text) and stop_reason not in ('max_tokens', 'model_context_window_exceeded'):
        return text

    candidate = text[:end].rstrip()
    # A character boundary may cut a word. Avoid keeping that fragment when
    # there is a preceding word; an oversized single word still stays bounded.
    if end < len(text) and not text[end].isspace() and candidate and not candidate[-1].isspace():
        cut = re.search(r'\s+\S*$', candidate)
        if cut:
            candidate = candidate[:cut.start()].rstrip()
    sentences = list(re.finditer(r'[.!?…](?:["\u201d\u2019\)\]]*)(?=\s|$)', candidate))
    if sentences:
        return candidate[:sentences[-1].end()]
    # No complete sentence is available: indicate the bounded fragment honestly.
    return candidate[:MAX_RESPONSE_CHARACTERS - 1].rstrip(' ,;:\u2026') + '…' if candidate else ''
