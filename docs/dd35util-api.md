# DD35Util API

Base URL when hosted under IIS:

```text
http://localhost/dd35util-api
```

Optional local root URL when registered as its own IIS site on port `5214`:

```text
http://localhost:5214
```

The port `5214` URL is not expected to be reachable unless either Kestrel is running or IIS has been configured with:

```powershell
D:\repos\DD35Utils\scripts\register-dd35util-api-iis-5214.ps1
```

## Health

### `GET /health`

Returns API/database status and the creature count in `DD35Util`.

Response schema:

```json
{
  "status": "string",
  "database": "string",
  "creatures": "integer"
}
```

Example:

```json
{
  "status": "ok",
  "database": "DD35Util",
  "creatures": 333
}
```

## Creatures

### `GET /api/creatures`

Returns a paged creature summary list.

Query parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `q` | string | No | Case-insensitive name search using SQL `LIKE`. |
| `animal` | boolean | No | Filters by the imported animal tag. |
| `cr` | string | No | Filters by exact challenge rating text. |
| `skip` | integer | No | Number of rows to skip. Defaults to `0`. |
| `take` | integer | No | Page size. Defaults to `50`; clamped to `1..200`. |

Response schema:

```json
{
  "skip": "integer",
  "take": "integer",
  "count": "integer",
  "items": [
    {
      "creatureId": "integer",
      "name": "string",
      "size": "string | null",
      "creatureType": "string | null",
      "alignment": "string | null",
      "armorClass": "integer | null",
      "hitPoints": "integer | null",
      "challengeRating": "string | null",
      "xp": "integer | null",
      "proficiencyBonus": "integer | null",
      "sourceSection": "string | null",
      "isAnimal": "boolean"
    }
  ]
}
```

Example:

```text
GET /api/creatures?take=2&q=dragon
```

### `GET /api/creatures/{id}`

Returns one creature detail row.

Path parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | Yes | `CreatureId` from `dbo.[dd55e.Creatures]`. |

Responses:

| Status | Description |
| --- | --- |
| `200` | Creature found. |
| `404` | No creature exists for the supplied ID. |

Response schema:

```json
{
  "creatureId": "integer",
  "sourceCreatureKey": "string | null",
  "name": "string",
  "size": "string | null",
  "creatureType": "string | null",
  "alignment": "string | null",
  "armorClass": "integer | null",
  "initiativeBonus": "integer | null",
  "initiativeScore": "integer | null",
  "hitPoints": "integer | null",
  "hitPointFormula": "string | null",
  "speedText": "string | null",
  "challengeRating": "string | null",
  "xp": "integer | null",
  "lairXp": "integer | null",
  "proficiencyBonus": "integer | null",
  "sensesText": "string | null",
  "passivePerception": "integer | null",
  "languagesText": "string | null",
  "sourceUrl": "string | null",
  "sourceSection": "string | null",
  "isAnimal": "boolean",
  "rawStatBlockText": "string | null"
}
```

## Creature Child Data

### `GET /api/creatures/{id}/abilities`

Returns ability scores for one creature.

Response schema:

```json
[
  {
    "abilityCode": "string",
    "score": "integer",
    "modifier": "integer",
    "saveBonus": "integer | null"
  }
]
```

### `GET /api/creatures/{id}/features`

Returns traits, actions, reactions, legendary actions, and other feature text for one creature.

Response schema:

```json
[
  {
    "sectionName": "string",
    "featureName": "string",
    "usageText": "string | null",
    "rechargeText": "string | null",
    "featureText": "string",
    "sortOrder": "integer"
  }
]
```

### `GET /api/creatures/{id}/defenses`

Returns resistances, immunities, vulnerabilities, and condition immunities for one creature.

Response schema:

```json
[
  {
    "defenseType": "string",
    "defenseName": "string",
    "rawText": "string | null"
  }
]
```

### `GET /api/creatures/{id}/speeds`

Returns parsed movement speeds for one creature.

Response schema:

```json
[
  {
    "speedType": "string",
    "distanceFeet": "integer | null",
    "qualifier": "string | null",
    "rawText": "string"
  }
]
```

## Notes

The API reads from these SQL Server tables:

```text
dbo.[dd55e.Creatures]
dbo.[dd55e.CreatureAbilityScores]
dbo.[dd55e.CreatureDefenses]
dbo.[dd55e.CreatureFeatures]
dbo.[dd55e.CreatureSpeeds]
```

The current IIS app path is expected to be:

```text
Default Web Site/dd35util-api
```
