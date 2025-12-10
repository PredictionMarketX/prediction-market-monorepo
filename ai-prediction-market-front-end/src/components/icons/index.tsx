import { SVGProps } from 'react';
import { TrendingUp, Users, Zap, BrainCircuit, Droplets, ShieldCheck } from 'lucide-react';

type IconProps = SVGProps<SVGSVGElement>;

export function LiquidityIcon(props: IconProps) {
  return <Droplets {...props} />;
}

export function VolumeIcon(props: IconProps) {
  return <TrendingUp {...props} />;
}

export function UsersIcon(props: IconProps) {
  return <Users {...props} />;
}

export function MarketsIcon(props: IconProps) {
  return <Zap {...props} />;
}

export function UptimeIcon(props: IconProps) {
  return <ShieldCheck {...props} />;
}

export function SolanaIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 17.5L8.5 13L17 13L21 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 6.5L8.5 11H17L21 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12L8.5 7.5H17L21 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AIIcon(props: IconProps) {
  return <BrainCircuit {...props} />;
}

// Map for dynamic icon rendering
export const featureIcons = {
  solana: SolanaIcon,
  ai: AIIcon,
  liquidity: LiquidityIcon,
  volume: VolumeIcon,
  users: UsersIcon,
  markets: MarketsIcon,
  uptime: UptimeIcon,
};

export type FeatureIconType = keyof typeof featureIcons;