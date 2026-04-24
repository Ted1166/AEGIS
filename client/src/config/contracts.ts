export const ADDRESSES = {
  vault:    '0x3C1b5aa1C2b914bDBfe3313cc2e2B3c850F94AFe',
  guard:    '0x205aE7eF827e92f9daB6B35CD84301A780C75C08',
  treasury: '0xc08757f4dA6b13e6Fa0d343F227fB751FC220e9b',
  oracle:   '0xb5b844ba8f544406d53fF7C7e0B43c008f8D16CF',
  usdc:     '0x4205DEBc42B91c7B13983C42B6808fC9F559d94b',
} as const;

export const VAULT_ABI = [
  'function deposit(uint256 amount) external returns (uint256 shares)',
  'function withdraw(uint256 shares) external returns (uint256 amount)',
  'function balanceOf(address user) external view returns (uint256)',
  'function getUserShares(address user) external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function totalShares() external view returns (uint256)',
  'function getYieldSources() external view returns (address[])',
  'function bufferBalance() external view returns (uint256)',
  'function rebalance() external',
  'event Deposited(address indexed user, uint256 amount, uint256 shares)',
  'event Withdrawn(address indexed user, uint256 shares, uint256 amount)',
  'event Rebalanced(address indexed caller, uint256 timestamp)',
] as const;

export const GUARD_ABI = [
  'function getSignalState(address protocol) external view returns (bool tvlDrainage, bool oracleDeviation, bool flashLoan, bool accessControl, bool bridgeAnomaly, uint256 totalActive)',
  'function isEmergency(address protocol) external view returns (bool)',
  'function isCheckable(address protocol) external view returns (bool)',
  'function checkAndExecute(address protocol) external returns (bool triggered)',
  'event EmergencyTriggered(address indexed caller, address indexed protocol, uint256 bountyPaid)',
  'event SignalRecorded(address indexed protocol, uint8 signal, uint256 value, uint256 timestamp)',
] as const;

export const ORACLE_ABI = [
  'function getScoreUnchecked(address protocol) external view returns (tuple(uint256 score, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 updatedAt, uint8 tier, bool active))',
  'function isScoreFresh(address protocol) external view returns (bool)',
  'function scores(address) external view returns (tuple(uint256 score, uint256 realYieldBps, uint256 emissionsYieldBps, uint256 totalAPYBps, uint256 tvl, uint256 updatedAt, uint8 tier, bool active))',
  'event ScoreUpdated(address indexed protocol, uint256 score, uint256 realYieldBps, uint256 totalAPYBps, uint256 tvl, uint8 tier)',
] as const;

export const TREASURY_ABI = [
  'function claimableBalance(address user) external view returns (uint256)',
  'function claim() external',
] as const;

export const USDC_ABI = [
  'function balanceOf(address) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
] as const;

export const YIELD_SOURCE_ABI = [
  'function name() external view returns (string)',
  'function currentAPY() external view returns (uint256)',
  'function protocolTVL() external view returns (uint256)',
  'function balanceOf() external view returns (uint256)',
] as const;

export const GAS_PARAMS = {
  gasLimit: 3_000_000n,
} as const;