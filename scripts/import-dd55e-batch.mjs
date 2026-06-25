import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlPath = path.join(root, "src", "dndbeyond-br-2024-creature-stat-blocks.html");
const outPath = path.join(root, "import_dd55e_batch.sql");
const sourceUrl = "https://www.dndbeyond.com/sources/dnd/br-2024/creature-stat-blocks";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const skip = Number(args.get("--skip") ?? 0);
const take = Number(args.get("--take") ?? 10);

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“/g, "-")
    .replace(/âˆ’/g, "-")
    .replace(/\u2212/g, "-")
    .trim();
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `N'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return Number.isFinite(value) ? String(value) : "NULL";
}

function parseSignedInt(value) {
  if (!value) return null;
  const normalized = value.replace(/\u2212/g, "-").replace(/âˆ’/g, "-").replace("+", "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntText(value) {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseHeader(block) {
  const heading = block.match(/<h[34][^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h[34]>/i);
  if (!heading) return null;
  if (/class="[^"]*quick-menu-exclude[^"]*"/i.test(heading[0])) return null;
  const id = decodeEntities(heading[1]);
  const headingHtml = heading[2];
  const link = headingHtml.match(/<a[^>]*class="[^"]*monster-tooltip[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const name = cleanText(link?.[2] ?? headingHtml);
  const href = link?.[1] ? new URL(decodeEntities(link[1]), "https://www.dndbeyond.com").href : `${sourceUrl}#${id}`;
  return { id, name, href };
}

function extractParagraphs(block) {
  const paragraphs = [];
  const matches = block.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi);
  for (const match of matches) {
    const attrs = match[1];
    const html = match[2];
    const text = cleanText(html);
    if (!text) continue;
    const strongEm = html.match(/<strong>\s*<em>([\s\S]*?)<\/em>\s*<\/strong>/i);
    paragraphs.push({
      attrs,
      html,
      text,
      header: /class="[^"]*monster-header[^"]*"/i.test(attrs),
      legendaryUses: /class="[^"]*legendary-actions[^"]*"/i.test(attrs),
      featureTitle: strongEm ? cleanText(strongEm[1]).replace(/\.$/, "") : null,
    });
  }
  return paragraphs;
}

function parseAbilities(block) {
  const rows = [...block.matchAll(/<tr>\s*<th>(Str|Dex|Con|Int|Wis|Cha)<\/th>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/gi)];
  return rows.map((row) => ({
    code: row[1],
    score: parseIntText(row[2]),
    modifier: parseSignedInt(cleanText(row[3])),
    save: parseSignedInt(cleanText(row[4])),
  }));
}

function parseTypeLine(text) {
  const [left, ...alignmentParts] = text.split(",");
  const [size, ...typeParts] = left.trim().split(/\s+/);
  return {
    size,
    creatureType: typeParts.join(" ") || null,
    alignment: alignmentParts.join(",").trim() || null,
  };
}

function parseSpeeds(text) {
  return text
    .replace(/^Speed\s+/i, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^(?:(Burrow|Climb|Fly|Swim)\s+)?(\d+)\s*ft\.?(?:\s*\(([^)]+)\))?/i);
      return {
        type: match?.[1] ?? "Walk",
        distance: match ? Number.parseInt(match[2], 10) : null,
        qualifier: match?.[3] ?? null,
        raw,
      };
    });
}

function parseSkills(text) {
  return text
    .replace(/^Skills\s+/i, "")
    .split(",")
    .map((part) => part.trim().match(/^(.+?)\s+([+\-\u2212]?\d+)$/))
    .filter(Boolean)
    .map((match) => ({ name: match[1].trim(), bonus: parseSignedInt(match[2]) }));
}

function parseSenses(text) {
  return text
    .replace(/^Senses\s+/i, "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const passive = raw.match(/^Passive Perception\s+(\d+)/i);
      const ranged = raw.match(/^(.+?)\s+(\d+)\s*ft\.?/i);
      return {
        name: passive ? "Passive Perception" : ranged ? ranged[1].trim() : raw,
        range: ranged ? Number.parseInt(ranged[2], 10) : null,
        raw,
      };
    });
}

function parseLanguages(text) {
  return text
    .replace(/^Languages\s+/i, "")
    .split(";")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const ranged = raw.match(/^(.+?)\s+(\d+)\s*ft\.?/i);
      return {
        name: ranged ? ranged[1].trim() : raw,
        range: ranged ? Number.parseInt(ranged[2], 10) : null,
        raw,
      };
    });
}

function parseDefenses(kind, text) {
  return text
    .replace(new RegExp(`^${kind}\\s+`, "i"), "")
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({ type: kind.replace(/s$/, ""), name, raw: text }));
}

function parseCr(text) {
  const cr = text.match(/^CR\s+([^(]+)\s+\((.+)\)$/i);
  if (!cr) return {};
  const body = cr[2];
  const xp = body.match(/XP\s+([\d,]+)/i);
  const lairXp = body.match(/or\s+([\d,]+)\s+in lair/i);
  const pb = body.match(/PB\s+([+\-\u2212]?\d+)/i);
  return {
    cr: cr[1].trim(),
    xp: xp ? parseIntText(xp[1]) : null,
    lairXp: lairXp ? parseIntText(lairXp[1]) : null,
    pb: pb ? parseSignedInt(pb[1]) : null,
  };
}

function splitUsage(title) {
  const match = title.match(/^(.+?)\s+\(([^)]*(?:\/Day|in Lair)[^)]*)\)$/i);
  if (!match) return { name: title, usage: null, recharge: null };
  return { name: match[1].trim(), usage: match[2].trim(), recharge: null };
}

function splitRecharge(title) {
  const match = title.match(/^(.+?)\s+\((Recharge[^)]*)\)$/i);
  if (!match) return splitUsage(title);
  return { name: match[1].trim(), usage: null, recharge: match[2].trim() };
}

function parseFeatures(paragraphs) {
  const features = [];
  let section = null;
  let lastFeature = null;
  let sort = 10;

  for (const paragraph of paragraphs) {
    if (paragraph.header) {
      section = paragraph.text;
      sort = section === "Traits" ? 10 : section === "Actions" ? 100 : section === "Bonus Actions" ? 150 : section === "Reactions" ? 175 : 200;
      lastFeature = null;
      continue;
    }
    if (!section) continue;
    if (paragraph.legendaryUses) {
      lastFeature = {
        section,
        name: "Legendary Action Uses",
        usage: null,
        recharge: null,
        text: paragraph.text,
        sortOrder: sort++,
      };
      features.push(lastFeature);
      continue;
    }
    if (paragraph.featureTitle) {
      const parsed = splitRecharge(paragraph.featureTitle);
      const text = cleanText(paragraph.html.replace(/<strong>\s*<em>[\s\S]*?<\/em>\s*<\/strong>/i, ""));
      lastFeature = {
        section,
        name: parsed.name.replace(/\.$/, ""),
        usage: parsed.usage,
        recharge: parsed.recharge,
        text,
        sortOrder: sort++,
      };
      features.push(lastFeature);
      continue;
    }
    if (lastFeature) {
      lastFeature.text = `${lastFeature.text} ${paragraph.text}`.trim();
    }
  }

  return features;
}

function parseCreature(block) {
  const header = parseHeader(block);
  if (!header) return null;
  const paragraphs = extractParagraphs(block);
  const typeInfo = parseTypeLine(paragraphs[0]?.text ?? "");
  const ac = paragraphs.find((p) => /^AC\s+/i.test(p.text))?.text.match(/^AC\s+(\d+)(?:\s+Initiative\s+([+\-\u2212]?\d+)\s+\((\d+)\))?/i);
  const hp = paragraphs.find((p) => /^HP\s+/i.test(p.text))?.text.match(/^HP\s+(\d+)(?:\s+\(([^)]+)\))?/i);
  const speedText = paragraphs.find((p) => /^Speed\s+/i.test(p.text))?.text ?? null;
  const sensesText = paragraphs.find((p) => /^Senses\s+/i.test(p.text))?.text ?? null;
  const languagesText = paragraphs.find((p) => /^Languages\s+/i.test(p.text))?.text ?? null;
  const crInfo = parseCr(paragraphs.find((p) => /^CR\s+/i.test(p.text))?.text ?? "");
  const passive = sensesText?.match(/Passive Perception\s+(\d+)/i);
  const monsterHref = header.href;

  return {
    key: header.id || slugFromName(header.name),
    name: header.name,
    sourceUrl: `${sourceUrl}#${header.id}`,
    monsterUrl: monsterHref,
    sourceSection: null,
    isAnimal: false,
    ...typeInfo,
    ac: ac ? parseIntText(ac[1]) : null,
    initiativeBonus: ac ? parseSignedInt(ac[2]) : null,
    initiativeScore: ac ? parseIntText(ac[3]) : null,
    hp: hp ? parseIntText(hp[1]) : null,
    hpFormula: hp?.[2] ?? null,
    speedText: speedText?.replace(/^Speed\s+/i, "") ?? null,
    cr: crInfo.cr ?? null,
    xp: crInfo.xp ?? null,
    lairXp: crInfo.lairXp ?? null,
    pb: crInfo.pb ?? null,
    sensesText: sensesText?.replace(/^Senses\s+/i, "") ?? null,
    passive: passive ? parseIntText(passive[1]) : null,
    languagesText: languagesText?.replace(/^Languages\s+/i, "") ?? null,
    raw: paragraphs.map((p) => p.text).join("\n"),
    abilities: parseAbilities(block),
    speeds: speedText ? parseSpeeds(speedText) : [],
    skills: parseSkills(paragraphs.find((p) => /^Skills\s+/i.test(p.text))?.text ?? ""),
    senses: sensesText ? parseSenses(sensesText) : [],
    languages: languagesText ? parseLanguages(languagesText) : [],
    defenses: [
      ...parseDefenses("Vulnerabilities", paragraphs.find((p) => /^Vulnerabilities\s+/i.test(p.text))?.text ?? ""),
      ...parseDefenses("Resistances", paragraphs.find((p) => /^Resistances\s+/i.test(p.text))?.text ?? ""),
      ...parseDefenses("Immunities", paragraphs.find((p) => /^Immunities\s+/i.test(p.text))?.text ?? ""),
    ],
    features: parseFeatures(paragraphs),
  };
}

function values(rows) {
  return rows.length ? rows.join(",\n") : null;
}

function insertCreatureSql(creature, index) {
  const creatureIdVar = `@CreatureId${index}`;
  const rows = [];
  rows.push(`
DECLARE ${creatureIdVar} int;
SELECT ${creatureIdVar} = CreatureId FROM dbo.[dd55e.Creatures] WHERE SourceId = @SourceId AND SourceCreatureKey = ${sqlString(creature.key)};
IF ${creatureIdVar} IS NOT NULL
BEGIN
    DELETE FROM dbo.[dd55e.CreatureFeatures] WHERE CreatureId = ${creatureIdVar};
    DELETE FROM dbo.[dd55e.CreatureDefenses] WHERE CreatureId = ${creatureIdVar};
    DELETE FROM dbo.[dd55e.CreatureLanguages] WHERE CreatureId = ${creatureIdVar};
    DELETE FROM dbo.[dd55e.CreatureSenses] WHERE CreatureId = ${creatureIdVar};
    DELETE FROM dbo.[dd55e.CreatureSkills] WHERE CreatureId = ${creatureIdVar};
    DELETE FROM dbo.[dd55e.CreatureSpeeds] WHERE CreatureId = ${creatureIdVar};
    DELETE FROM dbo.[dd55e.CreatureAbilityScores] WHERE CreatureId = ${creatureIdVar};
    DELETE FROM dbo.[dd55e.Creatures] WHERE CreatureId = ${creatureIdVar};
END;

INSERT dbo.[dd55e.Creatures]
(SourceId, SourceCreatureKey, Name, Size, CreatureType, Alignment, ArmorClass, InitiativeBonus, InitiativeScore, HitPoints, HitPointFormula, SpeedText, ChallengeRating, Xp, LairXp, ProficiencyBonus, SensesText, PassivePerception, LanguagesText, SourceUrl, SourceSection, RawStatBlockText, IsAnimal)
VALUES
(@SourceId, ${sqlString(creature.key)}, ${sqlString(creature.name)}, ${sqlString(creature.size)}, ${sqlString(creature.creatureType)}, ${sqlString(creature.alignment)}, ${sqlNumber(creature.ac)}, ${sqlNumber(creature.initiativeBonus)}, ${sqlNumber(creature.initiativeScore)}, ${sqlNumber(creature.hp)}, ${sqlString(creature.hpFormula)}, ${sqlString(creature.speedText)}, ${sqlString(creature.cr)}, ${sqlNumber(creature.xp)}, ${sqlNumber(creature.lairXp)}, ${sqlNumber(creature.pb)}, ${sqlString(creature.sensesText)}, ${sqlNumber(creature.passive)}, ${sqlString(creature.languagesText)}, ${sqlString(creature.sourceUrl)}, ${sqlString(creature.sourceSection)}, ${sqlString(creature.raw)}, ${creature.isAnimal ? "1" : "0"});
SET ${creatureIdVar} = SCOPE_IDENTITY();
`);

  const abilityRows = values(creature.abilities.map((a) => `(${creatureIdVar}, ${sqlString(a.code)}, ${sqlNumber(a.score)}, ${sqlNumber(a.modifier)}, ${sqlNumber(a.save)})`));
  if (abilityRows) rows.push(`INSERT dbo.[dd55e.CreatureAbilityScores] (CreatureId, AbilityCode, Score, Modifier, SaveBonus) VALUES\n${abilityRows};`);

  const speedRows = values(creature.speeds.map((s) => `(${creatureIdVar}, ${sqlString(s.type)}, ${sqlNumber(s.distance)}, ${sqlString(s.qualifier)}, ${sqlString(s.raw)})`));
  if (speedRows) rows.push(`INSERT dbo.[dd55e.CreatureSpeeds] (CreatureId, SpeedType, DistanceFeet, Qualifier, RawText) VALUES\n${speedRows};`);

  const skillRows = values(creature.skills.map((s) => `(${creatureIdVar}, ${sqlString(s.name)}, ${sqlNumber(s.bonus)})`));
  if (skillRows) rows.push(`INSERT dbo.[dd55e.CreatureSkills] (CreatureId, SkillName, Bonus) VALUES\n${skillRows};`);

  const senseRows = values(creature.senses.map((s) => `(${creatureIdVar}, ${sqlString(s.name)}, ${sqlNumber(s.range)}, ${sqlString(s.raw)})`));
  if (senseRows) rows.push(`INSERT dbo.[dd55e.CreatureSenses] (CreatureId, SenseName, RangeFeet, RawText) VALUES\n${senseRows};`);

  const languageRows = values(creature.languages.map((l) => `(${creatureIdVar}, ${sqlString(l.name)}, ${sqlNumber(l.range)}, ${sqlString(l.raw)})`));
  if (languageRows) rows.push(`INSERT dbo.[dd55e.CreatureLanguages] (CreatureId, LanguageName, RangeFeet, RawText) VALUES\n${languageRows};`);

  const defenseRows = values(creature.defenses.map((d) => `(${creatureIdVar}, ${sqlString(d.type)}, ${sqlString(d.name)}, ${sqlString(d.raw)})`));
  if (defenseRows) rows.push(`INSERT dbo.[dd55e.CreatureDefenses] (CreatureId, DefenseType, DefenseName, RawText) VALUES\n${defenseRows};`);

  const featureRows = values(creature.features.map((f) => `(${creatureIdVar}, ${sqlString(f.section)}, ${sqlString(f.name)}, ${sqlString(f.usage)}, ${sqlString(f.recharge)}, ${sqlString(f.text)}, ${sqlNumber(f.sortOrder)})`));
  if (featureRows) rows.push(`INSERT dbo.[dd55e.CreatureFeatures] (CreatureId, SectionName, FeatureName, UsageText, RechargeText, FeatureText, SortOrder) VALUES\n${featureRows};`);

  return rows.join("\n");
}

const html = fs.readFileSync(htmlPath, "utf8");
function parseBlocksWithSections(documentHtml) {
  const markerPattern = /<h2\b[^>]*>([\s\S]*?)<\/h2>|<div class="stat-block"[\s\S]*?<\/div>\s*(?=<hr class="separator">|<div class="stat-block"|<h[23]|<\/section>|<div id="comp-next-nav")/gi;
  const blocks = [];
  let section = null;

  for (const match of documentHtml.matchAll(markerPattern)) {
    if (match[0].startsWith("<h2")) {
      section = cleanText(match[1]);
      continue;
    }

    const creature = parseCreature(match[0]);
    if (!creature) continue;
    creature.sourceSection = section;
    creature.isAnimal = section === "Animals (A-Z)";
    blocks.push(creature);
  }

  return blocks;
}

const blocks = parseBlocksWithSections(html);

const batch = blocks.slice(skip, skip + take);
if (!batch.length) {
  throw new Error(`No stat blocks found for skip=${skip}, take=${take}. Parsed ${blocks.length} total.`);
}

const sql = `SET XACT_ABORT ON;

DECLARE @SourceUrl nvarchar(1000) = N'${sourceUrl}';
DECLARE @SourceId int;
SELECT @SourceId = SourceId FROM dbo.[dd55e.Sources] WHERE SourceCode = N'BR-2024';
IF @SourceId IS NULL
BEGIN
    INSERT dbo.[dd55e.Sources] (SourceCode, SourceName, SourceUrl)
    VALUES (N'BR-2024', N'D&D Beyond Basic Rules 2024 - Creature Stat Blocks', @SourceUrl);
    SET @SourceId = SCOPE_IDENTITY();
END;

${batch.map((creature, index) => insertCreatureSql(creature, index + 1)).join("\n")}

SELECT COUNT(*) AS TotalImportedCreatures FROM dbo.[dd55e.Creatures];
`;

fs.writeFileSync(outPath, sql, "utf8");
console.log(JSON.stringify({
  parsed: blocks.length,
  skip,
  take,
  output: outPath,
  batch: batch.map((creature) => creature.name),
}, null, 2));
