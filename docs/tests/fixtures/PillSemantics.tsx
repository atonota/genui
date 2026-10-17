import GenUXProvider from '../../src/react/GenUXProvider';
import GenUXPill from '../../src/react/GenUXPill';

export default function PillSemantics() {
  return (
    <GenUXProvider appearance="docs">
      <GenUXPill
        data-case="object"
        color="#f00"
        styles={{ root: { backgroundColor: '#123456', color: '#ffffff', borderColor: '#abcdef' } }}
      >
        Object override
      </GenUXPill>
      <GenUXPill
        data-case="function"
        color="#ee4444"
        styles={({ props }) => ({
          root: {
            backgroundColor: props.variant === 'filled' ? '#234567' : '#000000',
            color: '#ffffff',
          },
        })}
      >
        Function override
      </GenUXPill>
      <GenUXPill
        data-case="style"
        styles={{ root: { backgroundColor: '#123456' } }}
        style={{ backgroundColor: '#345678' }}
      >
        Explicit style
      </GenUXPill>
      <GenUXPill data-case="managed" color="#f00">
        Managed custom seed
      </GenUXPill>
    </GenUXProvider>
  );
}
