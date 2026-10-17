import { forwardRef } from 'react';
import { Slider } from 'antd';
import type { SliderRangeProps, SliderRef, SliderSingleProps } from 'antd/es/slider';

export type GenUXSliderProps = SliderSingleProps | SliderRangeProps;
export type { SliderRef as GenUXSliderRef };

/** Native Slider owns values, orientation, range, ARIA, keyboard and drag behavior. */
const GenUXSlider = forwardRef<SliderRef, GenUXSliderProps>(function GenUXSlider(
  { className, ...props },
  ref,
) {
  return (
    <Slider
      {...props}
      ref={ref}
      className={['genux-control', 'genux-slider', className].filter(Boolean).join(' ')}
    />
  );
});

export default GenUXSlider;
