import { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const StoreManagement = () => {
    const [stores, setStores] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterMode, setFilterMode] = useState('all'); 
    const [sortConfig, setSortConfig] = useState({ key: 'no', direction: 'desc' });
    const [copiedCell, setCopiedCell] = useState(null); 
    const [salesStatusFilter, setSalesStatusFilter] = useState('all'); // 販売ステータス絞り込み
    const fileInputRef = useRef(null);
    const bp50InputRef = useRef(null);
    const [bp50Result, setBp50Result] = useState(null); // null | { ok, ng, noId }

    // CSVのヘッダー名 → Firestoreフィールド名 のマッピング
    const fieldMapping = {
        storeId: 'store_id',
        no: 'no',
        storeName: 'store_name',
        corporateName: 'corporate_name',
        representative: 'representative',
        contactPerson: 'contact_person',
        email: 'email',
        password: 'password',
        initialPlan: 'initial_plan',
        planAddition: 'plan_addition',
        applicationDate: 'application_date',
        paymentDate: 'payment_date',
        paymentStatus: 'payment_status',
        docConsent: 'doc_consent',
        docRegistry: 'doc_registry',
        docResident: 'doc_resident',
        emailArrivalDate: 'email_arrival_date',
        originalArrivalDate: 'original_arrival_date',
        loginInfoSentDate: 'login_info_sent_date',
        renewalMonth: 'renewal_month',
        yearlyRenewalLegacy: 'yearly_renewal_legacy',
        distinction: 'distinction',
        salesOk: 'sales_ok',
        npSellerId: 'np_seller_id',
        remarks: 'remarks',
    };

    const mapStoreFromDB = (item) => {
        const isCompleted = (val) => val === '【両方済み】' || val === '提出済み' || val === '両方完了';
        const hasConsent = isCompleted(item.doc_consent) || item.doc_consent === '電子のみ';
        const hasRegistry = isCompleted(item.doc_registry) || item.doc_registry === '原本のみ' || item.doc_registry === '電子のみ';
        const hasResident = isCompleted(item.doc_resident) || item.doc_resident === '原本のみ' || item.doc_resident === '電子のみ';
        const isDocComplete = hasConsent && (hasRegistry || hasResident);

        const dist = item.distinction;
        const isSpecial = dist?.includes('特別');
        const isFounding = dist === 'FD店舗' || item.initial_plan?.includes('ファウンディング') || item.initial_plan?.includes('FD');
        
        let classification = '通常店舗';
        if (dist === '通常' || dist === '通常店舗') { classification = '通常店舗'; } 
        else if (isSpecial) { classification = '特別店舗'; } 
        else if (isFounding) { classification = 'FD店舗'; }

        let pStatus = item.payment_status;
        if (!pStatus || pStatus === '') { pStatus = item.payment_date ? '完了' : '未入金'; }
        const payment = (classification === 'FD店舗' || classification === '特別店舗') ? '免除' : pStatus;

        return {
            ...item,
            storeId: item.store_id || '',
            no: item.no || '',
            storeName: item.store_name || '',
            corporateName: item.corporate_name || '',
            representative: item.representative || '',
            contactPerson: item.contact_person || '',
            email: item.email || '',
            password: item.password || '',
            plan: item.initial_plan || '',
            dateSigned: item.application_date || '',
            paymentDate: item.payment_date || '',
            salesStatus: item.sales_ok || '準備中',
            yearlyRenewal: item.yearly_renewal_legacy || '',
            renewalMonth: item.renewal_month || '',
            payment,
            isDocComplete,
            classification,
            documents: {
                consent: item.doc_consent || '未提出',
                registry: item.doc_registry || '未提出',
                residentCard: item.doc_resident || '未提出',
            },
            remarks: item.remarks || '',
            raw: item
        };
    };

    const fetchStores = async () => {
        setIsLoading(true);
        try {
            const snapshot = await getDocs(collection(db, 'stores'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStores(data.map(mapStoreFromDB));
        } catch (err) { setError('取得失敗'); } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchStores(); }, []);

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const validData = results.data.filter(row => row.storeId && row.storeId !== '店舗ID');
                    const bulkData = validData.map(row => {
                        const mapped = {};
                        Object.keys(fieldMapping).forEach(csvKey => {
                            if (row[csvKey] !== undefined && row[csvKey] !== '') {
                                mapped[fieldMapping[csvKey]] = row[csvKey];
                            }
                        });
                        if (!mapped.store_id) mapped.store_id = row.storeId || Math.random().toString(36).substr(2, 9);
                        mapped.updated_at = new Date().toISOString();
                        return mapped;
                    });
                    if (bulkData.length === 0) { alert('有効なデータが見つかりませんでした。'); return; }
                    const { writeBatch, doc: firestoreDoc } = await import('firebase/firestore');
                    // Firestoreへバッチ書き込み（store_idをドキュメントIDとして使用）
                    const BATCH_SIZE = 400;
                    for (let i = 0; i < bulkData.length; i += BATCH_SIZE) {
                        const chunk = bulkData.slice(i, i + BATCH_SIZE);
                        const batch = writeBatch(db);
                        chunk.forEach(record => {
                            const docId = String(record.store_id);
                            const ref = firestoreDoc(collection(db, 'stores'), docId);
                            batch.set(ref, record, { merge: true });
                        });
                        await batch.commit();
                    }
                    alert(`${bulkData.length}件のデータをインポートしました。`);
                    await fetchStores();
                } catch (err) {
                    alert('インポートに失敗しました: ' + err.message);
                } finally {
                    setIsLoading(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            },
            error: (err) => { alert('CSVの解析に失敗しました: ' + err.message); setIsLoading(false); }
        });
    };

    const handleInlineSalesStatus = async (id, newStatus) => {
        try {
            await updateDoc(doc(db, 'stores', id), { sales_ok: newStatus });
            setStores(p => p.map(s => s.id === id ? { ...s, salesStatus: newStatus, raw: { ...s.raw, sales_ok: newStatus } } : s));
        } catch (err) { alert('更新失敗'); }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const f = new FormData(e.target);
        const dbData = {
            store_id: f.get('store_id'),
            no: f.get('no'),
            np_seller_id: f.get('np_seller_id'),
            store_name: f.get('store_name'),
            corporate_name: f.get('corporate_name'),
            representative: f.get('representative'),
            contact_person: f.get('contact_person'),
            email: f.get('email'),
            password: f.get('password'),
            sales_ok: f.get('sales_ok'),
            distinction: f.get('distinction'),
            payment_status: f.get('payment_status'),
            doc_consent: f.get('doc_consent'),
            doc_registry: f.get('doc_registry'),
            doc_resident: f.get('doc_resident'),
            initial_plan: f.get('initial_plan'),
            plan_addition: f.get('plan_addition'),
            application_date: f.get('application_date') || null,
            payment_date: f.get('payment_date') || null,
            email_arrival_date: f.get('email_arrival_date') || null,
            original_arrival_date: f.get('original_arrival_date') || null,
            login_info_sent_date: f.get('login_info_sent_date') || null,
            yearly_renewal_legacy: f.get('yearly_renewal_legacy'),
            renewal_month: f.get('renewal_month'),
            remarks: f.get('remarks'),
            updated_at: new Date().toISOString()
        };
        try {
            if (editingStore) { await setDoc(doc(db, 'stores', editingStore.id), dbData, { merge: true }); }
            else { await addDoc(collection(db, 'stores'), { ...dbData, created_at: new Date().toISOString() }); }
            await fetchStores(); setIsModalOpen(false); setEditingStore(null);
        } catch (err) { alert('保存失敗'); } finally { setIsLoading(false); }
    };

    const getBadgeClass = (s) => {
        if (s === '販売OK' || s === '【両方済み】' || s === 'OK') return 'badge success';
        if (s === '未入金' || s === '未提出' || s === '一時停止') return 'badge danger';
        return 'badge neutral';
    };

    // 販売ステータスのソート順（販売OKが先頭）
    const SALES_STATUS_ORDER = { '販売OK': 0, '準備中': 1, '未申請': 2, '一時停止': 3, '退会': 4 };

    const handleSort = (k) => {
        if (sortConfig.key === k) {
            setSortConfig({ key: k, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
        } else {
            setSortConfig({ key: k, direction: 'asc' });
        }
    };

    const handleExcelExport = () => {
        const exportData = filteredStores.map(s => ({
            'No': s.no,
            '店舗ID': s.storeId,
            '店舗名': s.storeName,
            '法人名': s.corporateName,
            '代表者名': s.representative,
            '担当者名': s.contactPerson,
            'メールアドレス': s.email,
            'パスワード': s.password,
            '個人会員ID': s.raw?.np_seller_id || '',
            '販売ステータス': s.salesStatus,
            '区別': s.raw?.distinction || '',
            '入金状況': s.payment,
            '同意書': s.documents?.consent || '',
            '登記簿': s.documents?.registry || '',
            '住民票': s.documents?.residentCard || '',
            '契約プラン': s.plan,
            'プラン追加': s.raw?.plan_addition || '',
            '申請フォーム受理日': s.dateSigned || '',
            '入金日': s.paymentDate || '',
            '電子データ着日': s.raw?.email_arrival_date || '',
            '原本着日': s.raw?.original_arrival_date || '',
            '契約締結日': s.raw?.login_info_sent_date || '',
            '契約更新状況': s.yearlyRenewal || '',
            '更新月': s.renewalMonth || '',
            '備考': s.remarks || '',
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '店舗一覧');
        XLSX.writeFile(wb, `店舗管理_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // 50BP照合処理
    const handle50BPCheck = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const csvIds = new Set(
                    results.data
                        .map(row => String(row['会員ID'] || '').trim())
                        .filter(id => id !== '')
                );

                const ok = [];
                const ng = [];
                const excluded = [];

                stores.forEach(s => {
                    const dbId = String(s.raw?.np_seller_id || '').trim();
                    const isSalesOk = s.salesStatus === '販売OK';

                    // 対象条件：個人会員IDあり & 販売OK
                    if (!dbId || !isSalesOk) {
                        excluded.push({ store: s, reason: !dbId ? 'ID未登録' : `販売ステータス:${s.salesStatus}` });
                    } else if (csvIds.has(dbId)) {
                        ok.push(s);
                    } else {
                        ng.push(s);
                    }
                });

                setBp50Result({ ok, ng, excluded, total: stores.length, csvCount: csvIds.size });
                if (bp50InputRef.current) bp50InputRef.current.value = '';
            },
            error: (err) => alert('CSVの解析に失敗しました: ' + err.message)
        });
    };

    const filteredStores = stores.filter(s => {
        const m = s.storeName?.includes(searchTerm) || s.representative?.includes(searchTerm) || s.storeId?.includes(searchTerm);
        if (!m) return false;
        if (salesStatusFilter !== 'all' && s.salesStatus !== salesStatusFilter) return false;
        if (filterMode === 'document-pending') return !s.isDocComplete;
        if (filterMode === 'unpaid') return s.payment === '未入金';
        if (filterMode === 'renewal-current') return s.salesStatus === '販売OK' && parseInt(s.renewalMonth) === (new Date().getMonth() + 1);
        return true;
    }).sort((a, b) => {
        const { key, direction } = sortConfig;
        // 販売ステータスは専用の順序でソート（販売OK先頭）
        if (key === 'salesStatus') {
            const oA = SALES_STATUS_ORDER[a.salesStatus] ?? 9;
            const oB = SALES_STATUS_ORDER[b.salesStatus] ?? 9;
            return direction === 'asc' ? oA - oB : oB - oA;
        }
        let valA = a[key] ?? ''; let valB = b[key] ?? '';
        if (key === 'no' || key === 'storeId') { 
            const nA = parseInt(String(valA).replace(/\D/g, ''), 10) || 0;
            const nB = parseInt(String(valB).replace(/\D/g, ''), 10) || 0;
            return direction === 'asc' ? nA - nB : nB - nA;
        }
        return direction === 'asc' ? String(valA).localeCompare(String(valB), 'ja') : String(valB).localeCompare(String(valA), 'ja');
    });

    return (
        <>
            <header className="header">
                <h1>店舗管理ダッシュボード</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="glass-btn secondary" onClick={handleExcelExport} disabled={isLoading}>📥 Excelエクスポート</button>
                    <button className="glass-btn secondary" onClick={() => bp50InputRef.current?.click()} disabled={isLoading}>🔍 50BP照合</button>
                    <input type="file" ref={bp50InputRef} onChange={handle50BPCheck} accept=".csv" style={{ display: 'none' }} />
                    <button className="glass-btn secondary" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>CSVインポート</button>
                    <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                    <button className="glass-btn" onClick={() => { setEditingStore(null); setIsModalOpen(true); }} disabled={isLoading}>+ 新規追加</button>
                </div>
            </header>

            <div className="stats-grid">
                <div className={`glass-panel stat-card clickable ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}><h3>総店舗数</h3><div className="value">{stores.length}</div></div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'renewal-current' ? 'active' : ''}`} onClick={() => setFilterMode('renewal-current')}><h3>今月更新 ({new Date().getMonth() + 1}月)</h3><div className="value">{stores.filter(s => s.salesStatus === '販売OK' && parseInt(s.renewalMonth) === (new Date().getMonth() + 1)).length}</div></div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'document-pending' ? 'active' : ''}`} onClick={() => setFilterMode('document-pending')}><h3>書類未提出</h3><div className="value">{stores.filter(s => !s.isDocComplete).length}</div></div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'unpaid' ? 'active' : ''}`} onClick={() => setFilterMode('unpaid')}><h3>未入金</h3><div className="value">{stores.filter(s => s.payment === '未入金').length}</div></div>
            </div>

            <div className="glass-panel table-panel">
                <div className="controls-bar">
                    <input type="text" className="search-input" placeholder="店舗名・代表者名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ minWidth: '320px', flex: 1 }} />
                    <select
                        value={salesStatusFilter}
                        onChange={(e) => setSalesStatusFilter(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', background: 'white' }}
                    >
                        <option value="all">すべてのステータス ({stores.length})</option>
                        <option value="販売OK">販売OK ({stores.filter(s => s.salesStatus === '販売OK').length})</option>
                        <option value="準備中">準備中 ({stores.filter(s => s.salesStatus === '準備中').length})</option>
                        <option value="未申請">未申請 ({stores.filter(s => s.salesStatus === '未申請').length})</option>
                        <option value="一時停止">一時停止 ({stores.filter(s => s.salesStatus === '一時停止').length})</option>
                        <option value="退会">退会 ({stores.filter(s => s.salesStatus === '退会').length})</option>
                    </select>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('no')} style={{cursor:'pointer'}}>No. {sortConfig.key==='no' ? (sortConfig.direction==='asc'?'↑':'↓') : ''}</th><th onClick={() => handleSort('storeId')} style={{cursor:'pointer'}}>ID {sortConfig.key==='storeId' ? (sortConfig.direction==='asc'?'↑':'↓') : ''}</th><th onClick={() => handleSort('salesStatus')} style={{cursor:'pointer'}}>販売ステータス {sortConfig.key==='salesStatus' ? (sortConfig.direction==='asc'?'↑':'↓') : '⇅'}</th><th>店舗名</th><th>代表者</th><th>メール</th><th>パスワード</th><th>アクション</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStores.map(s => {
                                const handleCopy = (t,f) => { if (!t) return; navigator.clipboard.writeText(t).then(() => { setCopiedCell(`${s.id}-${f}`); setTimeout(() => setCopiedCell(null), 1500); }); };
                                return (
                                    <tr key={s.id}>
                                        <td>{s.no}</td><td>{s.storeId}</td>
                                        <td>
                                            <select value={s.salesStatus || '準備中'} onChange={(e) => handleInlineSalesStatus(s.id, e.target.value)} className={getBadgeClass(s.salesStatus)} style={{ border: 'none', background: 'transparent', fontWeight: '600', color: s.classification === 'FD店舗' ? '#f97316' : s.classification === '特別店舗' ? '#a855f7' : '' }}>
                                                <option value="準備中">準備中</option><option value="未申請">未申請</option><option value="販売OK">販売OK</option><option value="一時停止">一時停止</option><option value="退会">退会</option>
                                            </select>
                                        </td>
                                        <td><strong style={{ color: s.classification === 'FD店舗' ? '#f97316' : s.classification === '特別店舗' ? '#a855f7' : '' }}>{s.storeName}</strong></td>
                                        <td>{s.representative}</td>
                                        <td><button className="action-btn" style={{ background: copiedCell === `${s.id}-e` ? '#22c55e' : '' }} onClick={() => handleCopy(s.email, 'e')}>{copiedCell === `${s.id}-e` ? '✓' : '📋'}</button></td>
                                        <td><button className="action-btn" style={{ background: copiedCell === `${s.id}-p` ? '#22c55e' : '' }} onClick={() => handleCopy(s.password, 'p')}>{copiedCell === `${s.id}-p` ? '✓' : '📋'}</button></td>
                                        <td><button className="action-btn edit-btn" onClick={() => { setEditingStore(s); setIsModalOpen(true); }}>編集</button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel">
                        <h2>店舗情報の編集</h2>
                        <form onSubmit={handleSave} className="modal-form">
                            <div className="modal-scroll-area">
                                <section>
                                    <h3>基本情報</h3>
                                    <div className="form-grid">
                                        <div className="form-group"><label>店舗ID</label><input type="text" name="store_id" defaultValue={editingStore?.storeId || ''} /></div>
                                        <div className="form-group"><label>No</label><input type="text" name="no" defaultValue={editingStore?.no || ''} /></div>
                                        <div className="form-group"><label>店舗名</label><input type="text" name="store_name" required defaultValue={editingStore?.storeName || ''} /></div>
                                        <div className="form-grid full-width" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', gridColumn: '1 / -1' }}>
                                            <div className="form-group"><label>法人名</label><input type="text" name="corporate_name" defaultValue={editingStore?.corporateName || ''} /></div>
                                            <div className="form-group"><label>代表者名</label><input type="text" name="representative" required defaultValue={editingStore?.representative || ''} /></div>
                                        </div>
                                        <div className="form-group"><label>担当者名</label><input type="text" name="contact_person" defaultValue={editingStore?.contactPerson || ''} /></div>
                                        <div className="form-group"><label>メール</label><input type="email" name="email" defaultValue={editingStore?.email || ''} /></div>
                                        <div className="form-group"><label>パスワード</label><input type="text" name="password" defaultValue={editingStore?.password || ''} /></div>
                                        <div className="form-group"><label>個人会員ID</label><input type="text" name="np_seller_id" defaultValue={editingStore?.raw?.np_seller_id || ''} /></div>
                                    </div>
                                </section>
                                <section>
                                    <h3>進捗・設定</h3>
                                    <div className="form-grid">
                                        <div className="form-group"><label>販売ステータス</label><select name="sales_ok" defaultValue={editingStore?.raw?.sales_ok || '準備中'}><option value="準備中">準備中</option><option value="未申請">未申請</option><option value="販売OK">販売OK</option><option value="一時停止">一時停止</option><option value="退会">退会</option></select></div>
                                        <div className="form-group"><label>区別</label><select name="distinction" defaultValue={editingStore?.raw?.distinction || '通常'}><option value="通常">通常</option><option value="FD店舗">FD店舗</option><option value="特別店舗">特別店舗</option></select></div>
                                        <div className="form-group"><label>入金状況</label><select name="payment_status" defaultValue={editingStore?.raw?.payment_status || '未入金'}><option value="完了">完了</option><option value="免除">免除</option><option value="未入金">未入金</option></select></div>
                                        <div className="form-group"><label>同意書</label><select name="doc_consent" defaultValue={editingStore?.raw?.doc_consent || '未提出'}><option value="【両方済み】">【両方済み】</option><option value="原本のみ">原本のみ</option><option value="電子のみ">電子のみ</option><option value="不要">不要</option><option value="未提出">未提出</option></select></div>
                                        <div className="form-group"><label>登記簿</label><select name="doc_registry" defaultValue={editingStore?.raw?.doc_registry || '未提出'}><option value="【両方済み】">【両方済み】</option><option value="原本のみ">原本のみ</option><option value="電子のみ">電子のみ</option><option value="不要">不要</option><option value="未提出">未提出</option></select></div>
                                        <div className="form-group"><label>住民票</label><select name="doc_resident" defaultValue={editingStore?.raw?.doc_resident || '未提出'}><option value="【両方済み】">【両方済み】</option><option value="原本のみ">原本のみ</option><option value="電子のみ">電子のみ</option><option value="不要">不要</option><option value="未提出">未提出</option></select></div>
                                    </div>
                                </section>
                                <section>
                                    <h3>契約・日付</h3>
                                    <div className="form-grid">
                                        <div className="form-group"><label>契約プラン</label><select name="initial_plan" defaultValue={editingStore?.raw?.initial_plan || ''}><option value="">未設定</option><option value="FD30品目プラン">FD30品目プラン</option><option value="10品目プラン">10品目プラン</option><option value="30品目プラン">30品目プラン</option><option value="50品目プラン">50品目プラン</option><option value="無制限プラン">無制限プラン</option></select></div>
                                        <div className="form-group"><label>プラン追加</label><select name="plan_addition" defaultValue={editingStore?.raw?.plan_addition || 'なし'}><option value="なし">なし</option><option value="追加20品目">追加20品目</option></select></div>
                                        <div className="form-group"><label>申請フォーム受理日</label><input type="date" name="application_date" defaultValue={editingStore?.dateSigned?.slice(0, 10) || ''} /></div>
                                        <div className="form-group"><label>入金日</label><input type="date" name="payment_date" defaultValue={editingStore?.paymentDate?.slice(0, 10) || ''} /></div>
                                        <div className="form-group"><label>原本着日</label><input type="date" name="original_arrival_date" defaultValue={editingStore?.raw?.original_arrival_date?.slice(0, 10) || ''} /></div>
                                        <div className="form-group"><label>電子データ着日</label><input type="date" name="email_arrival_date" defaultValue={editingStore?.raw?.email_arrival_date?.slice(0, 10) || ''} /></div>
                                        <div className="form-group"><label>契約締結日</label><input type="date" name="login_info_sent_date" defaultValue={editingStore?.raw?.login_info_sent_date?.slice(0, 10) || ''} /></div>
                                        <div className="form-group"><label>更新状況</label><select name="yearly_renewal_legacy" defaultValue={editingStore?.yearly_renewal_legacy || ''}><option value="">未設定</option><option value="2025年支払済">2025年支払済</option><option value="2026年支払済">2026年支払済</option></select></div>
                                        <div className="form-group"><label>更新月</label><select name="renewal_month" defaultValue={editingStore?.raw?.renewal_month || ''}><option value="">未設定</option><option value="更新なし">更新なし</option>{[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}</select></div>
                                    </div>
                                </section>
                                <section><textarea name="remarks" placeholder="備考" defaultValue={editingStore?.remarks || ''} className="w-full h-24 p-2 mt-4 glass-panel"></textarea></section>
                            </div>
                            <div className="modal-actions"><button type="button" className="action-btn cancel-btn" onClick={() => setIsModalOpen(false)}>閉じる</button><button type="submit" className="glass-btn">保存</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* 50BP照合結果モーダル */}
            {bp50Result && (
                <div className="modal-overlay" onClick={() => setBp50Result(null)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                        <h2>🔍 50BP照合結果</h2>
                        <p style={{ color: '#64748b', marginBottom: '16px' }}>
                            照合対象（販売OK & ID登録済）: {bp50Result.ok.length + bp50Result.ng.length}件 | CSV内ID数: {bp50Result.csvCount}件 | 
                            <span style={{ color: '#22c55e', fontWeight: 700 }}> ✅ OK: {bp50Result.ok.length}件</span> | 
                            <span style={{ color: '#ef4444', fontWeight: 700 }}> ❌ NG: {bp50Result.ng.length}件</span> | 
                            <span style={{ color: '#94a3b8' }}> 対象外: {bp50Result.excluded.length}件</span>
                        </p>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>店舗名</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>個人会員ID</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>販売ステータス</th>
                                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>50BP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* NG → OK → 対象外 の順で表示 */}
                                    {bp50Result.ng.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff1f2' }}>
                                            <td style={{ padding: '10px', fontWeight: 600 }}>{s.storeName}</td>
                                            <td style={{ padding: '10px', fontFamily: 'monospace', color: '#64748b' }}>{s.raw?.np_seller_id || ''}</td>
                                            <td style={{ padding: '10px' }}>{s.salesStatus}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '1.1rem' }}><span style={{ color: '#ef4444', fontWeight: 700 }}>❌ NG</span></td>
                                        </tr>
                                    ))}
                                    {bp50Result.ok.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                                            <td style={{ padding: '10px', fontWeight: 600 }}>{s.storeName}</td>
                                            <td style={{ padding: '10px', fontFamily: 'monospace', color: '#64748b' }}>{s.raw?.np_seller_id || ''}</td>
                                            <td style={{ padding: '10px' }}>{s.salesStatus}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '1.1rem' }}><span style={{ color: '#22c55e', fontWeight: 700 }}>✅ OK</span></td>
                                        </tr>
                                    ))}
                                    {bp50Result.excluded.map(({ store: s, reason }) => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc', opacity: 0.6 }}>
                                            <td style={{ padding: '10px', fontWeight: 600 }}>{s.storeName}</td>
                                            <td style={{ padding: '10px', fontFamily: 'monospace', color: '#94a3b8' }}>{s.raw?.np_seller_id || '未登録'}</td>
                                            <td style={{ padding: '10px', color: '#94a3b8' }}>{s.salesStatus}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>対象外 ({reason})</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-actions" style={{ marginTop: '20px' }}>
                            <button className="glass-btn" onClick={() => {
                                // 結果をExcelでダウンロード
                                const data = [
                                    ...bp50Result.ng.map(s => ({ '店舗名': s.storeName, '個人会ID': s.raw?.np_seller_id || '', '販売ステータス': s.salesStatus, '50BP': 'NG' })),
                                    ...bp50Result.ok.map(s => ({ '店舗名': s.storeName, '個人会ID': s.raw?.np_seller_id || '', '販売ステータス': s.salesStatus, '50BP': 'OK' })),
                                    ...bp50Result.noId.map(s => ({ '店舗名': s.storeName, '個人会ID': '未登録', '販売ステータス': s.salesStatus, '50BP': 'ID未登録' })),
                                ];
                                const ws = XLSX.utils.json_to_sheet(data);
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, '50BP照合');
                                XLSX.writeFile(wb, `50BP照合_${new Date().toISOString().split('T')[0]}.xlsx`);
                            }}>📥 Excelで保存</button>
                            <button className="action-btn cancel-btn" onClick={() => setBp50Result(null)}>閉じる</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
export default StoreManagement;
