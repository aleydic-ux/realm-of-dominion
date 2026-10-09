-- Berserker never had a double-attack mechanic; its 10 offense already reflects it
UPDATE troop_types SET special_ability = 'High attack; dies if defending'
WHERE race = 'orc' AND name = 'Berserker';
