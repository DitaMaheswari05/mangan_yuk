import React from 'react';
import Svg, { Path } from 'react-native-svg';

type NavIconProps = {
  name: 'explore' | 'search' | 'trail' | 'profile';
  color: string;
  size?: number;
};

export function NavIcon({ name, color, size = 24 }: NavIconProps) {
  switch (name) {
    case 'explore':
      return (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
          <Path
            d="M0.767442 12.0744V14.0698C0.767442 19.186 2.81395 21.2326 7.93023 21.2326H14.0698C19.186 21.2326 21.2326 19.186 21.2326 14.0698V7.93023C21.2326 2.81395 19.186 0.767442 14.0698 0.767442H7.93023C2.81395 0.767442 0.767442 2.81395 0.767442 7.93023"
            stroke={color}
            strokeWidth={1.53488}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M16.4754 7.98118L14.081 15.6965C13.5079 17.5282 10.9396 17.5589 10.3359 15.7375L9.61958 13.6193C9.42516 13.0361 8.96469 12.5654 8.38144 12.3812L6.25307 11.6649C4.4419 11.0612 4.4726 8.47235 6.30423 7.91979L14.0196 5.51513C15.534 5.05467 16.9563 6.477 16.4754 7.98118Z"
            stroke={color}
            strokeWidth={1.53488}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M11.5 2C16.75 2 21 6.25 21 11.5C21 16.75 16.75 21 11.5 21C6.25 21 2 16.75 2 11.5C2 7.8 4.11 4.6 7.2 3.03"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M22 22L20 20"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'trail':
      return (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
          <Path
            d="M5.84232 8.33916C5.00483 9.1358 3.68731 9.12559 2.84982 8.33916C1.70593 7.24634 0.38841 5.48965 0.868436 3.41635C1.6855 -0.117453 7.00663 -0.117453 7.81348 3.41635C7.93604 3.9168 7.94626 4.38662 7.88498 4.84621"
            stroke={color}
            strokeWidth={1.532}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14.1457 15.6723C14.9628 12.1385 20.3145 12.1385 21.1316 15.6723C21.6116 17.7456 20.2941 19.5023 19.14 20.5951C18.3025 21.3918 16.9748 21.3816 16.1373 20.5951C14.9832 19.5023 13.6657 17.7456 14.1457 15.6723Z"
            stroke={color}
            strokeWidth={1.532}
          />
          <Path
            d="M11.0099 3.825H13.7471C15.6365 3.825 16.5149 6.16385 15.0952 7.40987L6.93481 14.549C5.51516 15.7848 6.3935 18.1236 8.27275 18.1236H11.0099"
            stroke={color}
            strokeWidth={1.532}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M4.357 4.33567H4.3688"
            stroke={color}
            strokeWidth={1.532}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17.6343 16.5916H17.6461"
            stroke={color}
            strokeWidth={1.532}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 22" fill="none">
          <Path
            d="M11.6198 2.79774C12.1153 3.53073 12.4044 4.40825 12.4044 5.35803C12.3941 7.83574 10.4429 9.84887 7.98584 9.93146C7.8826 9.92114 7.75872 9.92114 7.64515 9.93146C5.3636 9.85919 3.51565 8.11448 3.26788 5.88454C2.96849 3.23134 5.1468 0.774282 7.81033 0.774282"
            stroke={color}
            strokeWidth={1.54856}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M2.64805 13.7409C0.149695 15.4134 0.149695 18.1389 2.64805 19.801C5.48708 21.7006 10.1431 21.7006 12.9821 19.801C15.4805 18.1285 15.4805 15.4031 12.9821 13.7409C10.1637 11.8517 5.50773 11.8517 2.64805 13.7409Z"
            stroke={color}
            strokeWidth={1.54856}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
  }
}
