import type { JsonValue } from '../contracts';
import {
  assertId,
  nativeRecord,
  safeMediaSource,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const MAX_PEOPLE = 24;
const MAX_NAME = 80;

function parsePerson(input: JsonValue, index: number, seen: Set<string>): NativePayload {
  const path = `AtlasAvatarGroup.people[${index}]`;
  const record = nativeRecord(input, ['id', 'name', 'src'], ['id', 'name']);
  const { id, name } = record;
  assertId(id, `${path}.id`);
  if (seen.has(id)) throw new Error('Duplicate avatar group person identity.');
  seen.add(id);
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME)
    throw new Error(`${path}.name: expected non-empty bounded text.`);
  const person: NativePayload = { id, name };
  if (Object.hasOwn(record, 'src')) person.src = safeMediaSource(record.src);
  return person;
}

/** Read-only people list; the model never selects a renderer, URL endpoint or style. */
function parse(input: unknown): NativePayload {
  const data = nativeRecord(input, ['people', 'maxVisible'], ['people']);
  const people = data.people;
  if (!Array.isArray(people) || people.length < 1 || people.length > MAX_PEOPLE)
    throw new Error(`AtlasAvatarGroup.people: expected 1 to ${MAX_PEOPLE} people.`);
  const seen = new Set<string>();
  const result: NativePayload = {
    people: people.map((person, index) => parsePerson(person, index, seen)),
  };
  if (Object.hasOwn(data, 'maxVisible')) {
    const maxVisible = data.maxVisible;
    if (
      typeof maxVisible !== 'number' ||
      !Number.isInteger(maxVisible) ||
      maxVisible < 1 ||
      maxVisible > MAX_PEOPLE
    )
      throw new Error(`AtlasAvatarGroup.maxVisible: expected an integer from 1 to ${MAX_PEOPLE}.`);
    result.maxVisible = maxVisible;
  }
  return result;
}

export const definition: NativeDefinition = {
  name: 'AtlasAvatarGroup',
  readOnly: true,
  parse,
};

export const sample: NativePayload = {
  people: [
    { id: 'ada', name: 'Ada Lovelace', src: '/media/avatars/ada.png' },
    { id: 'grace', name: 'Grace Hopper' },
    { id: 'katherine', name: 'Katherine Johnson' },
    { id: 'mary', name: 'Mary Jackson' },
    { id: 'dorothy', name: 'Dorothy Vaughan' },
  ],
  maxVisible: 3,
};
