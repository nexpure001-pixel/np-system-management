/**
 * 個人会員ID一括登録スクリプト
 * 使用方法: node import-member-ids.mjs
 *
 * CSVの「店舗メールアドレス」と「パスワード」でSupabaseの店舗を照合し、
 * 「個人会員ID」を np_seller_id カラムに一括書き込みます。
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

// ── CSV パーサー（クォート対応）─────────────────
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

// 全角スペース・半角スペース・CC:以降を除去してメアドを抽出
function extractEmail(raw) {
    if (!raw) return null;
    const match = raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase().trim() : null;
}

// ── メイン処理 ────────────────────────────────
async function main() {
    const csvPath = path.join(__dirname, '個人会員IDでーた.csv');
    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '');

    // ヘッダー確認
    const headers = parseCSVLine(lines[0]);
    console.log('CSV列:', headers.slice(0, 10).join(' | '));

    const EMAIL_IDX    = 8;  // 店舗メールアドレス
    const PASSWORD_IDX = 9;  // パスワード
    const MEMBER_IDX   = 2;  // 個人会員ID

    // Supabaseから全店舗を取得（email, password, id）
    console.log('\nSupabaseから店舗データを取得中...');
    const { data: stores, error } = await supabase
        .from('stores')
        .select('id, email, password, store_id');
    if (error) { console.error('取得エラー:', error.message); process.exit(1); }
    console.log(`店舗数: ${stores.length}件`);

    // メール→店舗のMapを作成（小文字で正規化）
    const storeMap = new Map();
    for (const s of stores) {
        if (s.email) {
            const key = `${s.email.toLowerCase().trim()}:::${String(s.password || '').trim()}`;
            storeMap.set(key, s);
        }
    }

    let matched = 0, skipped = 0, noId = 0;
    const updates = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const memberId  = (cols[MEMBER_IDX]  || '').trim();
        const emailRaw  = (cols[EMAIL_IDX]   || '').trim();
        const password  = (cols[PASSWORD_IDX]|| '').trim();

        if (!memberId) { noId++; continue; }

        const email = extractEmail(emailRaw);
        if (!email) { skipped++; continue; }

        // メール+パスワードで照合
        const key = `${email}:::${password}`;
        const store = storeMap.get(key);

        if (store) {
            updates.push({ id: store.id, np_seller_id: memberId, email, store_id: store.store_id });
            matched++;
        } else {
            // パスワードなしでメールのみで再試行
            let fallback = null;
            for (const s of stores) {
                if (s.email && s.email.toLowerCase().trim() === email) {
                    fallback = s;
                    break;
                }
            }
            if (fallback) {
                updates.push({ id: fallback.id, np_seller_id: memberId, email, store_id: fallback.store_id });
                console.log(`  ⚠️  PW不一致→メールのみ照合: ${email} (CSV-PW:${password})`);
                matched++;
            } else {
                console.log(`  ✗ 未照合: ${email} (PW:${password}, 会員ID:${memberId})`);
                skipped++;
            }
        }
    }

    console.log(`\n照合結果: 一致${matched}件 / 未一致${skipped}件 / 個人ID未記載${noId}件`);
    if (updates.length === 0) { console.log('更新対象なし'); return; }

    // 確認表示
    console.log('\n=== 更新予定一覧 ===');
    for (const u of updates) {
        console.log(`  店舗ID:${u.store_id} | メール:${u.email} | 個人会員ID:${u.np_seller_id}`);
    }

    // Supabase更新
    console.log('\nSupabaseへ書き込み中...');
    let successCount = 0;
    for (const u of updates) {
        const { error: upErr } = await supabase
            .from('stores')
            .update({ np_seller_id: u.np_seller_id })
            .eq('id', u.id);
        if (upErr) {
            console.error(`  ✗ 更新失敗(${u.email}): ${upErr.message}`);
        } else {
            successCount++;
        }
    }
    console.log(`\n✅ 完了: ${successCount}/${updates.length}件 更新しました`);
}

main().catch(e => { console.error(e); process.exit(1); });
