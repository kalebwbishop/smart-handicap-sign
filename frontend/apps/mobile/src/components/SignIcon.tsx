import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type SignIconProps = {
	size?: number;
	color?: string;
};

const SignIcon = ({ size = 24, color = "white" }: SignIconProps) => {
    const STROKE_WIDTH = 2;

	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            
			<Circle
				cx={12}
				cy={12}
				r={2}
				stroke={color}
				strokeWidth={STROKE_WIDTH}
				fill="none"
			/>


            {/* Follows the curvature of a radius 6 circle with arc of 80 degrees */}
			<Path
				d="M19.66 5.57 A10 10 0 0 1 19.66 18.43"
				stroke={color}
				strokeWidth={STROKE_WIDTH}
				strokeLinecap="round"
			/>
            <Path
				d="M19.66 5.57 A10 10 0 0 1 19.66 18.43"
				stroke={color}
				strokeWidth={STROKE_WIDTH}
				strokeLinecap="round"
                transform="rotate(180 12 12)"
			/>
            
            {/* Follows the curvature of a radius 10 circle with arc of 80 degrees */}
            <Path
				d="M16.6 8.14 A6 6 0 0 1 16.6 15.86"
				stroke={color}
				strokeWidth={STROKE_WIDTH}
				strokeLinecap="round"
			/>
            <Path
				d="M16.6 8.14 A6 6 0 0 1 16.6 15.86"
				stroke={color}
				strokeWidth={STROKE_WIDTH}
				strokeLinecap="round"
                transform="rotate(180 12 12)"
			/>
		</Svg>
	);
};

export default SignIcon;
