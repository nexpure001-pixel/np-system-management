/**
 * 店舗詳細情報一括インポートスクリプト v2
 * 
 * 改良点:
 * 1. メールアドレス + パスワード による照合
 * 2. 入力値の正規化（全角→半角、不要な文字列の除去）
 * 3. 列ズレへの柔軟な対応（特定行のデータ特性に基づく）
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://aosrdhlxfewpqhgjfmjb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3JkaGx4ZmV3cHFoZ2pmbWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTQ0NDgsImV4cCI6MjA4NDQzMDQ0OH0.OY1lZAfzjq0FOExufZjJ2pwqmF83ge8XSeQ5_mxB3hs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function extractEmail(raw) {
    if (!raw) return null;
    const match = raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase().trim() : null;
}

function normalizeDate(raw) {
    if (!raw) return null;
    let val = String(raw).trim()
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/年|月/g, '/')
        .replace(/日/, '');
    
    // 不要な文言を除外
    if (/特例|未定|原本|済み|停止|対応|処理|決済|要注意|退会|まだ|未完|-/.test(val)) return null;

    if (val.includes('/')) {
        const parts = val.split('/').filter(p => p !== '');
        if (parts.length >= 2) {
            const y = parts[0].length === 4 ? parts[0] : (parts[0].length === 2 ? `20${parts[0]}` : null);
            if (!y) return null;
            const m = parts[1].padStart(2, '0');
            const d = (parts[2] || '01').split(' ')[0].split('\n')[0].replace(/\D/g, '').padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            if (!isNaN(new Date(dateStr).getTime())) return dateStr;
        }
    }
    return null;
}

function normalizeMonth(raw) {
    if (!raw) return null;
    const val = String(raw).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const m = val.match(/(\d+)月/);
    if (m) return m[1];
    const n = val.match(/^\d+$/);
    if (n) return n[0];
    return null;
}

async function main() {
    const csvPath = path.join(__dirname, '店舗管理シート.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');
    
    // 行分割
    const rows = [];
    let currentRow = '';
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch === '"') inQuotes = !inQuotes;
        if (ch === '\n' && !inQuotes) {
            rows.push(currentRow);
            currentRow = '';
        } else {
            currentRow += ch;
        }
    }
    if (currentRow) rows.push(currentRow);

    console.log(`CSV読み込み: ${rows.length}行`);

    // Supabaseから店舗情報を取得 (email, password)
    const { data: dbStores, error } = await supabase.from('stores').select('id, email, password, store_id, store_name');
    if (error) throw error;
    
    // 照合用マップ作成 (key: email:::password)
    const storeMap = new Map();
    dbStores.forEach(s => {
        if (s.email) {
            const key = `${s.email.toLowerCase().trim()}:::${String(s.password || '').trim()}`;
            storeMap.set(key, s);
        }
    });

    const results = { matched: 0, skipped: 0, updated: 0 };
    const updates = [];

    // 固定的なインデックス（ヘッダー解析を基本とするが、ズレ対策ロジックを併用）
    const EMAIL_IDX = 12;
    const PASS_IDX = 13;
    const APP_DATE_IDX = 18;
    const PAY_DATE_IDX = 20;
    const LOGIN_SENT_IDX = 26;
    const RENEWAL_MONTH_IDX = 27;

    for (let i = 0; i < rows.length; i++) {
        const cols = parseCSVLine(rows[i]);
        if (cols.length < 14) continue;

        const email = extractEmail(cols[EMAIL_IDX]);
        const pass = String(cols[PASS_IDX] || '').trim();
        
        if (!email) continue;

        const key = `${email}:::${pass}`;
        const store = storeMap.get(key);

        if (store) {
            results.matched++;

            // データの抽出（列ズレ対策: 26-27列目が月情報か日付情報かをチェック）
            let app_date = normalizeDate(cols[APP_DATE_IDX]);
            let pay_date = normalizeDate(cols[PAY_DATE_IDX]);
            let login_sent = normalizeDate(cols[LOGIN_SENT_IDX]);
            let renewal_m = normalizeMonth(cols[RENEWAL_MONTH_IDX]);

            // 特殊ケース：26列目が日付ではなく「月情報」になっている場合の補正
            if (!login_sent && normalizeMonth(cols[LOGIN_SENT_IDX]) && !renewal_m) {
                renewal_m = normalizeMonth(cols[LOGIN_SENT_IDX]);
            }

            const updateData = {};
            if (app_date) updateData.application_date = app_date;
            if (pay_date) updateData.payment_date = pay_date;
            if (login_sent) updateData.login_info_sent_date = login_sent;
            if (renewal_m) updateData.renewal_month = renewal_m;

            if (Object.keys(updateData).length > 0) {
                updates.push({ id: store.id, ...updateData, info: `${store.store_name} (${store.store_id})` });
            }
        } else {
            // console.log(`  ✗ 未一致: ${email} ::: ${pass}`);
            results.skipped++;
        }
    }

    console.log(`\n照合結果: 一致 ${results.matched}件 / 不一致 ${results.skipped}件`);
    console.log(`更新対象（何らかのデータあり）: ${updates.length}件`);

    if (updates.length > 0) {
        console.log('\nSupabase更新中...');
        for (const u of updates) {
            const { id, info, ...data } = u;
            const { error: upErr } = await supabase.from('stores').update(data).eq('id', id);
            if (upErr) {
                console.error(`  ✗ 更新失敗 [${info}]:`, upErr.message);
            } else {
                results.updated++;
            }
        }
    }

    console.log(`\n✅ 完了: ${results.updated}件 更新しました。`);
}

main().catch(console.error);
