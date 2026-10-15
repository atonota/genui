import atlas from '../data/atlas.json';

export type IconLibrary = keyof typeof atlas.icons;
export type AtlasIconName =
  | keyof typeof atlas.icons.phosphor.icons
  | 'minus'
  | 'trash'
  | 'x'
  | 'smiley'
  | 'smiley-sad'
  | 'sun'
  | 'moon'
  | 'house'
  | 'lock-simple';

// Phosphor core 2.1.1, regular weight; the existing /licenses/ page carries its MIT notice.
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/minus.svg
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/trash.svg
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/x.svg
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/smiley.svg
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/smiley-sad.svg
const extraPhosphor = {
  // https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/house.svg
  house: {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z',
      },
    ],
  },
  // https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/sun.svg
  sun: {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z',
      },
    ],
  },
  // https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/moon.svg
  moon: {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z',
      },
    ],
  },
  // https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/lock-simple.svg
  'lock-simple': {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z',
      },
    ],
  },

  smiley: {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.07,48c-10.29,17.79-27.4,28-46.93,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.07-20a8,8,0,0,1,13.86,8Z',
      },
    ],
  },
  'smiley-sad': {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.08,64a8,8,0,1,1-13.84,8c-7.47-12.91-19.21-20-33.08-20s-25.61,7.1-33.08,20a8,8,0,1,1-13.84-8c10.29-17.79,27.39-28,46.92-28S164.63,154.2,174.92,172Z',
      },
    ],
  },
  x: {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z',
      },
    ],
  },
  minus: {
    viewBox: '0 0 256 256',
    paths: [{ d: 'M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z' }],
  },
  trash: {
    viewBox: '0 0 256 256',
    paths: [
      {
        d: 'M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z',
      },
    ],
  },
};

export default function AtlasIcon({
  name,
  library = 'phosphor',
  className = 'atlas-icon',
  motion,
}: {
  name: string;
  library?: IconLibrary;
  className?: string;
  motion?: string;
}) {
  const local = Object.hasOwn(extraPhosphor, name);
  const catalog = atlas.icons[library].icons;
  const icon = local
    ? extraPhosphor[name as keyof typeof extraPhosphor]
    : Object.hasOwn(catalog, name)
      ? catalog[name as keyof typeof catalog]
      : null;
  if (!icon) return null;
  return (
    <svg
      className={className}
      viewBox={icon.viewBox}
      fill="currentColor"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      data-icon-library={local ? 'phosphor' : library}
      data-icon-name={name}
      data-icon-motion={motion}
    >
      {icon.paths.map((path, index) => (
        <path key={index} {...path} />
      ))}
    </svg>
  );
}
