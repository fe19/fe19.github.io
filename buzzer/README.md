# Buzzer-Runde

Multiplayer quiz buzzer at https://fe19.github.io/buzzer/

- Create a group and share the 5-character code or link (`/buzzer/#CODE`).
- There is no game master: anyone can release the buzzer, everyone else presses it, and anyone can reset for the next round.
- The order is ranked by reaction time, measured on each device from the moment the release arrives there, so device clocks don't matter.

## How it syncs

Static page, no server of its own. Players sync through the public HiveMQ broker (`wss://broker.hivemq.com:8884/mqtt`) using retained messages under `fe19-buzzer/v1/<CODE>/`:

| Topic | Payload |
| --- | --- |
| `state` | `{seq, type: "open" \| "reset", by, byName}` |
| `presence/<id>` | `{name}`, cleared on leave or by the broker's last will |
| `buzz/<id>` | `{seq, ms, name}` |

The public broker has no guarantees and anyone who knows a code can join that group. For local testing, pass another broker: `?broker=ws://localhost:8080/`.
