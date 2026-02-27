import { addMonths, isSameDay, startOfDay, isBefore, addYears, isAfter } from 'date-fns';

/**
 * 労働基準法に基づく有給付与日数の定義
 * 勤続年数(ヶ月) -> 付与日数
 */
const LEAVE_ENTITLEMENTS = [
    { months: 6, days: 10 },    // 0.5年
    { months: 18, days: 11 },   // 1.5年
    { months: 30, days: 12 },   // 2.5年
    { months: 42, days: 14 },   // 3.5年
    { months: 54, days: 16 },   // 4.5年
    { months: 66, days: 18 },   // 5.5年
    { months: 78, days: 20 },   // 6.5年
];

/**
 * 入社日に基づき、「現在有効であるべき過去の付与データ」を全て算出する
 * (時効2年を迎えていないもの)
 */
export function getValidPastGrants(joinedAt, checkDate = new Date()) {
    const start = startOfDay(new Date(joinedAt));
    const target = startOfDay(new Date(checkDate));
    const results = [];

    // 1. 定義リストをチェック
    for (const ent of LEAVE_ENTITLEMENTS) {
        const grantDate = addMonths(start, ent.months);
        const expiryDate = addYears(grantDate, 100); // 実質無期限 (元のコードの設定)

        if (isBefore(grantDate, target) || isSameDay(grantDate, target)) {
            results.push({
                days: ent.days,
                grantDate,
                expiryDate,
                yearsOfService: ent.months / 12
            });
        }
    }

    // 2. 6.5年以降のループチェック
    let currentMonths = 78 + 12; // 7.5年から
    const MAX_MONTHS = 12 * 50;

    while (currentMonths < MAX_MONTHS) {
        const grantDate = addMonths(start, currentMonths);
        const expiryDate = addYears(grantDate, 100);

        if (isAfter(grantDate, target)) {
            break;
        }

        results.push({
            days: 20,
            grantDate,
            expiryDate,
            yearsOfService: currentMonths / 12
        });

        currentMonths += 12;
    }

    return results;
}

/**
 * 指定日に付与される有給日数を計算
 */
export function calculateGrantDays(joinedAt, checkDate = new Date()) {
    const pastGrants = getValidPastGrants(joinedAt, checkDate);
    const todayGrant = pastGrants.find(g => isSameDay(g.grantDate, new Date(checkDate)));
    return todayGrant ? todayGrant.days : 0;
}
