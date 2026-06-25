SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @SourceId int;
DECLARE @CreatureId int;

IF EXISTS (SELECT 1 FROM dbo.[dd55e.Sources] WHERE SourceCode = N'WIKIDOT-YUAN-TI')
BEGIN
    UPDATE dbo.[dd55e.Sources]
    SET SourceName = N'D&D 5e Wikidot - Yuan-Ti Lineage',
        SourceUrl = N'https://dnd5e.wikidot.com/lineage:yuan-ti'
    WHERE SourceCode = N'WIKIDOT-YUAN-TI';

    SELECT @SourceId = SourceId
    FROM dbo.[dd55e.Sources]
    WHERE SourceCode = N'WIKIDOT-YUAN-TI';
END
ELSE
BEGIN
    INSERT INTO dbo.[dd55e.Sources] (SourceCode, SourceName, SourceUrl)
    VALUES (
        N'WIKIDOT-YUAN-TI',
        N'D&D 5e Wikidot - Yuan-Ti Lineage',
        N'https://dnd5e.wikidot.com/lineage:yuan-ti'
    );

    SET @SourceId = CONVERT(int, SCOPE_IDENTITY());
END;

SELECT @CreatureId = CreatureId
FROM dbo.[dd55e.Creatures]
WHERE SourceCreatureKey = N'lineage:yuan-ti';

IF @CreatureId IS NULL
BEGIN
    INSERT INTO dbo.[dd55e.Creatures] (
        SourceId,
        SourceCreatureKey,
        Name,
        Size,
        CreatureType,
        Alignment,
        SpeedText,
        SensesText,
        LanguagesText,
        SourceUrl,
        SourceSection,
        RawStatBlockText,
        IsAnimal
    )
    VALUES (
        @SourceId,
        N'lineage:yuan-ti',
        N'Yuan-Ti',
        N'Medium or Small',
        N'Humanoid',
        N'Any; Volo purebloods are typically neutral evil',
        N'30 ft.',
        N'Darkvision 60 ft.',
        N'Mordenkainen: Common and one agreed appropriate language. Volo: Common, Abyssal, and Draconic.',
        N'https://dnd5e.wikidot.com/lineage:yuan-ti',
        N'Lineages',
        N'Mordenkainen Presents: Monsters of the Multiverse: Yuan-ti were originally humans who transformed themselves into serpent folk through ancient rituals. Creature Type: Humanoid. Size: Medium or Small. Speed: 30 feet. Darkvision: 60 feet. Magic Resistance: advantage on saving throws against spells. Poison Resilience: advantage on saving throws to avoid or end the poisoned condition and resistance to poison damage. Serpentine Spellcasting: Poison Spray cantrip; Animal Friendship at will targeting only snakes; Suggestion starting at 3rd level once per long rest or with spell slots; Intelligence, Wisdom, or Charisma is chosen as spellcasting ability. Languages: Common and one other appropriate language. Volo''s Guide to Monsters: Charisma +2 and Intelligence +1. Purebloods mature as humans and have similar lifespans. Alignment typically neutral evil. Size Medium. Speed 30 feet. Darkvision 60 feet. Innate Spellcasting uses Charisma. Magic Resistance includes spells and other magical effects. Poison Immunity grants immunity to poison damage and poisoned condition. Languages: Common, Abyssal, and Draconic.',
        0
    );

    SET @CreatureId = CONVERT(int, SCOPE_IDENTITY());
END
ELSE
BEGIN
    UPDATE dbo.[dd55e.Creatures]
    SET SourceId = @SourceId,
        Name = N'Yuan-Ti',
        Size = N'Medium or Small',
        CreatureType = N'Humanoid',
        Alignment = N'Any; Volo purebloods are typically neutral evil',
        SpeedText = N'30 ft.',
        SensesText = N'Darkvision 60 ft.',
        LanguagesText = N'Mordenkainen: Common and one agreed appropriate language. Volo: Common, Abyssal, and Draconic.',
        SourceUrl = N'https://dnd5e.wikidot.com/lineage:yuan-ti',
        SourceSection = N'Lineages',
        RawStatBlockText = N'Mordenkainen Presents: Monsters of the Multiverse: Yuan-ti were originally humans who transformed themselves into serpent folk through ancient rituals. Creature Type: Humanoid. Size: Medium or Small. Speed: 30 feet. Darkvision: 60 feet. Magic Resistance: advantage on saving throws against spells. Poison Resilience: advantage on saving throws to avoid or end the poisoned condition and resistance to poison damage. Serpentine Spellcasting: Poison Spray cantrip; Animal Friendship at will targeting only snakes; Suggestion starting at 3rd level once per long rest or with spell slots; Intelligence, Wisdom, or Charisma is chosen as spellcasting ability. Languages: Common and one other appropriate language. Volo''s Guide to Monsters: Charisma +2 and Intelligence +1. Purebloods mature as humans and have similar lifespans. Alignment typically neutral evil. Size Medium. Speed 30 feet. Darkvision 60 feet. Innate Spellcasting uses Charisma. Magic Resistance includes spells and other magical effects. Poison Immunity grants immunity to poison damage and poisoned condition. Languages: Common, Abyssal, and Draconic.',
        IsAnimal = 0
    WHERE CreatureId = @CreatureId;
END;

DELETE FROM dbo.[dd55e.CreatureFeatures] WHERE CreatureId = @CreatureId;
DELETE FROM dbo.[dd55e.CreatureSpeeds] WHERE CreatureId = @CreatureId;
DELETE FROM dbo.[dd55e.CreatureSenses] WHERE CreatureId = @CreatureId;
DELETE FROM dbo.[dd55e.CreatureLanguages] WHERE CreatureId = @CreatureId;
DELETE FROM dbo.[dd55e.CreatureDefenses] WHERE CreatureId = @CreatureId;

INSERT INTO dbo.[dd55e.CreatureSpeeds] (CreatureId, SpeedType, DistanceFeet, Qualifier, RawText)
VALUES (@CreatureId, N'walk', 30, NULL, N'30 ft.');

INSERT INTO dbo.[dd55e.CreatureSenses] (CreatureId, SenseName, RangeFeet, RawText)
VALUES (@CreatureId, N'Darkvision', 60, N'Darkvision 60 ft.');

INSERT INTO dbo.[dd55e.CreatureLanguages] (CreatureId, LanguageName, RangeFeet, RawText)
VALUES
    (@CreatureId, N'Common', NULL, N'Mordenkainen: Common and one agreed appropriate language. Volo: Common, Abyssal, and Draconic.'),
    (@CreatureId, N'One appropriate language', NULL, N'Mordenkainen: Common and one agreed appropriate language.'),
    (@CreatureId, N'Abyssal', NULL, N'Volo: Common, Abyssal, and Draconic.'),
    (@CreatureId, N'Draconic', NULL, N'Volo: Common, Abyssal, and Draconic.');

INSERT INTO dbo.[dd55e.CreatureDefenses] (CreatureId, DefenseType, DefenseName, RawText)
VALUES
    (@CreatureId, N'Resistance', N'Poison', N'Mordenkainen: resistance to poison damage.'),
    (@CreatureId, N'Immunity', N'Poison', N'Volo: immune to poison damage and the poisoned condition.'),
    (@CreatureId, N'Condition Immunity', N'Poisoned', N'Volo: immune to the poisoned condition.');

INSERT INTO dbo.[dd55e.CreatureFeatures] (CreatureId, SectionName, FeatureName, UsageText, RechargeText, FeatureText, SortOrder)
VALUES
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Ability Score Increase', NULL, NULL, N'Increase one ability score by 2 and a different score by 1, or increase three different scores by 1. Scores cannot be raised above 20.', 10),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Creature Type', NULL, NULL, N'You are a Humanoid.', 20),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Size', NULL, NULL, N'You are Medium or Small. You choose the size when you select this race.', 30),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Speed', NULL, NULL, N'Your walking speed is 30 feet.', 40),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Darkvision', NULL, NULL, N'You can see in dim light within 60 feet as bright light and in darkness as dim light. Colors in darkness are shades of gray.', 50),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Magic Resistance', NULL, NULL, N'You have advantage on saving throws against spells.', 60),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Poison Resilience', NULL, NULL, N'You have advantage on saving throws to avoid or end the poisoned condition on yourself, and you have resistance to poison damage.', 70),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Serpentine Spellcasting', NULL, NULL, N'You know Poison Spray. You can cast Animal Friendship without limit, targeting only snakes. Starting at 3rd level, you can cast Suggestion once per long rest with this trait or by using spell slots of 2nd level or higher. Intelligence, Wisdom, or Charisma is your spellcasting ability, chosen when selecting this race.', 80),
    (@CreatureId, N'Mordenkainen Presents: Monsters of the Multiverse', N'Languages', NULL, NULL, N'You can speak, read, and write Common and one other language that you and your DM agree is appropriate.', 90),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Ability Score Increase', NULL, NULL, N'Your Charisma score increases by 2, and your Intelligence score increases by 1.', 110),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Age', NULL, NULL, N'Purebloods mature at the same rate as humans and have lifespans similar in length to theirs.', 120),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Alignment', NULL, NULL, N'Purebloods are devoid of emotion and see others as tools to manipulate. They care little for law or chaos and are typically neutral evil.', 130),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Size', NULL, NULL, N'Purebloods match humans in average size and weight. Your size is Medium.', 140),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Speed', NULL, NULL, N'Your base walking speed is 30 feet.', 150),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Darkvision', NULL, NULL, N'You can see in dim light within 60 feet as bright light and in darkness as dim light. You cannot discern color in darkness, only shades of gray.', 160),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Innate Spellcasting', NULL, NULL, N'You know Poison Spray. You can cast Animal Friendship without limit, targeting only snakes. Starting at 3rd level, you can cast Suggestion once per long rest. Charisma is your spellcasting ability for these spells.', 170),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Magic Resistance', NULL, NULL, N'You have advantage on saving throws against spells and other magical effects.', 180),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Poison Immunity', NULL, NULL, N'You are immune to poison damage and the poisoned condition.', 190),
    (@CreatureId, N'Volo''s Guide to Monsters', N'Languages', NULL, NULL, N'You can speak, read, and write Common, Abyssal, and Draconic.', 200);

COMMIT TRANSACTION;

SELECT CreatureId, Name, Size, CreatureType, SpeedText, SensesText, LanguagesText, SourceUrl, SourceSection, IsAnimal
FROM dbo.[dd55e.Creatures]
WHERE CreatureId = @CreatureId;
