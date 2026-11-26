type ShareInput = { sharePercentage: string | number | null | undefined };

export const isAuto = (n: ShareInput) =>
  n.sharePercentage === "" || n.sharePercentage === null || n.sharePercentage === undefined;

export function withEffectiveShares<T extends ShareInput>(list: T[]) {
  const fixedSum = list.filter(n => !isAuto(n)).reduce((s, n) => s + Number(n.sharePercentage), 0);
  const autoCount = list.filter(isAuto).length;
  const remaining = Math.max(0, 100 - fixedSum);
  let given = 0;
  let seen = 0;
  return list.map(n => {
    if (!isAuto(n)) return { ...n, sharePercentage: Number(n.sharePercentage), shareIsAuto: false };
    seen++;
    const share = seen === autoCount
      ? Math.round((remaining - given) * 100) / 100
      : Math.floor((remaining / autoCount) * 100) / 100;
    given += share;
    return { ...n, sharePercentage: share, shareIsAuto: true };
  });
}

export function restoreShare<T extends ShareInput & { shareIsAuto: boolean }>(nominee: T) {
  return { ...nominee, sharePercentage: nominee.shareIsAuto ? "" : Number(nominee.sharePercentage) };
}
