/**
 * 店舗詳細情報一括インポートスクリプト
 * 使用方法: node import-store-details.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Supabase 接続 ──────────────────────────────
const SUPABASE_URL = 'https://aosrdhlxfewpqhgjfmjb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3JkaGx4ZmV3cHFoZ2pmbWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTQ0NDgsImV4cCI6MjA4NDQzMDQ0OH0.OY1lZAfzjq0FOExufZjJ2pwqmF83ge8XSeQ5_mxB3hs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CSV パーサー（クォート・改行対応）─────────────
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
}

// 日付形式の正規化 (YYYY/MM/DD -> YYYY-MM-DD)
function normalizeDate(raw) {
    if (!raw) return null;
    let val = String(raw).trim()
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角数字
        .replace(/年|月/g, '/')
        .replace(/日/, '');
    
    if (val === '-' || val === '未定' || val === '特例' || val === 'マネージャー対応' || val === '原本のみ' || val === '済み' || val === '停止') return null;
    
    // YYYY/M/D の形を想定
    if (val.includes('/')) {
        const parts = val.split('/').filter(p => p !== '');
        if (parts.length >= 3) {
            const y = parts[0];
            const m = parts[1].padStart(2, '0');
            const d = parts[2].split(' ')[0].split('\n')[0].padStart(2, '0');
            // 正当な日付かチェック
            const dateStr = `${y}-${m}-${d}`;
            if (!isNaN(new Date(dateStr).getTime())) return dateStr;
        }
    }
    
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
}

// 更新月の正規化 ("8月" -> "8")
function normalizeMonth(raw) {
    if (!raw || raw === '-' || raw === '未定') return null;
    const m = String(raw)
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .match(/\d+/);
    return m ? m[0] : null;
}

async function main() {
    const csvPath = path.join(__dirname, '店舗管理シート.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('エラー: 店舗管理シート.csv が見つかりません。');
        process.exit(1);
    }
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    
    // クォート内の改行を保持しつつ行分割
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

    console.log(`CSV読み込み完了: ${rows.length}行`);

    // 固定インデックス (CSV解析結果に基づく)
    const STORE_ID_IDX = 7;
    const APP_DATE_IDX = 18;
    const PAY_DATE_IDX = 20;
    const LOGIN_SENT_IDX = 26;
    const RENEWAL_MONTH_IDX = 27;

    // Supabaseから現存する全店舗を取得
    const { data: stores, error } = await supabase.from('stores').select('id, store_id');
    if (error) {
        console.error('Supabase取得エラー:', error.message);
        process.exit(1);
    }
    console.log(`Supabaseから店舗情報を取得しました: ${stores.length}件`);

    const storeMap = new Map();
    stores.forEach(s => {
        if (s.store_id) {
            storeMap.set(String(s.store_id).trim(), s.id);
        }
    });

    const updates = [];
    for (let i = 0; i < rows.length; i++) {
        const cols = parseCSVLine(rows[i]);
        if (cols.length <= STORE_ID_IDX) continue;
        
        const rawStoreId = cols[STORE_ID_IDX];
        if (!rawStoreId || rawStoreId === '店舗ID' || rawStoreId === 'ID') continue;

        // 店舗IDとして妥当か（数字またはハイフンあり）
        if (!/^[0-9\-]+$/.test(rawStoreId) && !rawStoreId.includes('-')) continue;

        const storeId = String(rawStoreId).trim();
        const internalId = storeMap.get(storeId);

        if (internalId) {
            const application_date = normalizeDate(cols[APP_DATE_IDX]);
            const payment_date = normalizeDate(cols[PAY_DATE_IDX]);
            const login_info_sent_date = normalizeDate(cols[LOGIN_SENT_IDX]);
            const renewal_month = normalizeMonth(cols[RENEWAL_MONTH_IDX]);

            // 何か一つでも有効な値があれば更新対象
            if (application_date || payment_date || login_info_sent_date || renewal_month) {
                updates.push({
                    id: internalId,
                    storeId,
                    application_date,
                    payment_date,
                    login_info_sent_date,
                    renewal_month
                });
            }
        }
    }

    console.log(`照合成功（更新候補）: ${updates.length}件`);

    if (updates.length === 0) {
        console.log('更新すべきデータが見つかりませんでした。マッチングキー（店舗ID）を確認してください。');
        return;
    }

    console.log('\nSupabaseへの一括更新を開始します...');
    let successCount = 0;
    for (const u of updates) {
        // nullでない値のみオブジェクトに含める（既存データを消さないように、必要なら検討）
        // 今回の要件は「CSVにあるデータを入れる」なので、nullも含めて上書きします
        const { error: upErr } = await supabase.from('stores').update({
            application_date: u.application_date,
            payment_date: u.payment_date,
            login_info_sent_date: u.login_info_sent_date,
            renewal_month: u.renewal_month
        }).eq('id', u.id);

        if (upErr) {
            console.error(`  ✗ 更新失敗 [ID: ${u.storeId}]: ${upErr.message}`);
        } else {
            successCount++;
            if (successCount % 50 === 0) console.log(`  ...${successCount}件完了`);
        }
    }

    console.log(`\n✅ インポート完了: ${successCount} / ${updates.length} 件を更新しました。`);
}

main().catch(err => {
    console.error('致命的なエラー:', err);
    process.exit(1);
});
