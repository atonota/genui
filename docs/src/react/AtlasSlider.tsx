import { forwardRef } from 'react';
import { Slider } from 'antd';
import type { SliderRangeProps, SliderRef, SliderSingleProps } from 'antd/es/slider';

export type AtlasSliderProps = SliderSingleProps | SliderRangeProps;
export type { SliderRef as AtlasSliderRef };

/** Native Slider owns values, orientation, range, ARIA, keyboard and drag behavior. */
const AtlasSlider = forwardRef<SliderRef, AtlasSliderProps>(function AtlasSlider(
  { className, ...props },
  ref,
) {
  return (
    <Slider
      {...props}
      ref={ref}
      className={['atlas-control', 'atlas-slider', className].filter(Boolean).join(' ')}
    />
  );
});

export default AtlasSlider;
