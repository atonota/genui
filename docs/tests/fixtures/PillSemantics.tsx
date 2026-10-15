import AtlasProvider from '../../src/react/AtlasProvider';
import AtlasPill from '../../src/react/AtlasPill';

export default function PillSemantics() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasPill
        data-case="object"
        color="#f00"
        styles={{ root: { backgroundColor: '#123456', color: '#ffffff', borderColor: '#abcdef' } }}
      >
        Object override
      </AtlasPill>
      <AtlasPill
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
      </AtlasPill>
      <AtlasPill
        data-case="style"
        styles={{ root: { backgroundColor: '#123456' } }}
        style={{ backgroundColor: '#345678' }}
      >
        Explicit style
      </AtlasPill>
      <AtlasPill data-case="managed" color="#f00">
        Managed custom seed
      </AtlasPill>
    </AtlasProvider>
  );
}
