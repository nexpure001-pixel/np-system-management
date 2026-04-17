import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Papa from 'papaparse';

const StoreManagement = () => {
    const [stores, setStores] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'document-pending', 'renewal-current', 'unpaid'
    const [sortConfig, setSortConfig] = useState({ key: 'no', direction: 'desc' });
    const [copiedCell, setCopiedCell] = useState(null); // コピー完了フィードバック用
    const fileInputRef = useRef(null);

    // フィールドマッピング定義 (CSV -> DB)
    const fieldMapping = {
        // 日本語ヘッダー
        '販売OK': 'sales_ok',
        '更新案内': 'yearly_renewal_legacy',
        '更新月': 'yearly_renewal_month',
        'No.': 'no',
        'NP店舗ID': 'np_seller_id',
        '紹介者': 'introducer',
        '店舗ID': 'store_id',
        '店名': 'store_name',
        '法人名': 'corporate_name',
        '代表者': 'representative',
        '担当者': 'contact_person',
        'メールアドレス': 'email',
        'パスワード': 'password',
        '初期プラン': 'initial_plan',
        'プラン追加': 'plan_addition',
        '申込フォーム': 'application_form',
        '申込日': 'application_date',
        '初期費用': 'initial_cost',
        '振込日': 'payment_date',
        '承諾書': 'doc_consent',
        '登記簿': 'doc_registry',
        '住民票': 'doc_resident',
        'メール着': 'email_arrival_date',
        '原本着': 'original_arrival_date',
        'ログイン情報送付日': 'login_info_sent_date',
        '次回更新月': 'renewal_month',
        '備考': 'remarks',
        '商品設定プラン': 'product_setting_plan',
        '未購入リスト': 'not_purchased_list',
        '活動中変更': 'changed_during_activity',
        '発送日入力済み': 'shipping_date_entered',
        '区分': 'distinction',
        '入金ステータス': 'payment_status',

        // 英語ヘッダー (CSVからのインポート用)
        'salesOk': 'sales_ok',
        'yearlyRenewal': 'yearly_renewal_legacy',
        'yearlyRenewalMonth': 'yearly_renewal_month',
        'no': 'no',
        'npSellerId': 'np_seller_id',
        'introducer': 'introducer',
        'storeId': 'store_id',
        'storeName': 'store_name',
        'corporateName': 'corporate_name',
        'representative': 'representative',
        'contactPerson': 'contact_person',
        'email': 'email',
        'password': 'password',
        'initialPlan': 'initial_plan',
        'planAddition': 'plan_addition',
        'applicationForm': 'application_form',
        'applicationDate': 'application_date',
        'initialCost': 'initial_cost',
        'paymentDate': 'payment_date',
        'docConsent': 'doc_consent',
        'docRegistry': 'doc_registry',
        'docResident': 'doc_resident',
        'emailArrivalDate': 'email_arrival_date',
        'originalArrivalDate': 'original_arrival_date',
        'loginInfoSentDate': 'login_info_sent_date',
        'renewalMonth': 'renewal_month',
        'remarks': 'remarks',
        'productSettingPlan': 'product_setting_plan',
        'notPurchasedList': 'not_purchased_list',
        'changedDuringActivity': 'changed_during_activity',
        'shippingDateEntered': 'shipping_date_entered',
        'distinction': 'distinction',
        'paymentStatus': 'payment_status'
    };

    // データ表示用のキーに変換 (DB -> UI)
    const mapStoreFromDB = (item) => {
        const hasConsent = item.doc_consent === '提出済み' || item.doc_consent === '両方完了' || item.doc_consent === '電子のみ';
        const hasRegistry = item.doc_registry === '提出済み' || item.doc_registry === '両方完了' || item.doc_registry === '原本のみ' || item.doc_registry === '電子のみ';
        const hasResident = item.doc_resident === '提出済み' || item.doc_resident === '両方完了' || item.doc_resident === '原本のみ' || item.doc_resident === '電子のみ';
        const isDocComplete = hasConsent && (hasRegistry || hasResident);

        const isFounding = item.initial_plan?.includes('ファウンディング') || item.initial_plan?.includes('FD') || item.distinction === 'FD店舗';
        const isSpecial = item.distinction?.includes('特別');
        const classification = isSpecial ? '特別店舗' : (isFounding ? 'FD店舗' : '通常店舗');

        // 入金状況の判定ロジックを統一
        let paymentStatusValue = item.payment_status;
        if (!paymentStatusValue || paymentStatusValue === '') {
            paymentStatusValue = item.payment_date ? '完了' : '未入金';
        }
        const payment = (classification === 'FD店舗' || classification === '特別店舗') ? '免除' : paymentStatusValue;

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

    // DB保存用の形式に変換 (UI -> DB)
    const mapStoreToDB = (formData, originalRaw = {}) => {
        const data = { ...originalRaw };
        const toNullifEmpty = (val) => (val === '' || val === '-' || val === undefined || val === null) ? null : val;

        data.sales_ok = formData.get('sales_ok');
        data.yearly_renewal_legacy = toNullifEmpty(formData.get('yearly_renewal_legacy'));
        // yearly_renewal_month はフォームに入力欄がないため、元のDB値を保持する（誤ってnullで上書きしない）
        data.yearly_renewal_month = originalRaw.yearly_renewal_month ?? null;
        data.no = formData.get('no');
        data.np_seller_id = formData.get('np_seller_id');
        data.introducer = formData.get('introducer');
        data.store_id = formData.get('store_id') || null;
        data.store_name = formData.get('store_name');
        data.corporate_name = formData.get('corporate_name');
        data.representative = formData.get('representative');
        data.contact_person = formData.get('contact_person');
        data.email = formData.get('email');
        data.password = formData.get('password');
        data.initial_plan = formData.get('initial_plan');
        data.plan_addition = formData.get('plan_addition');
        data.application_form = formData.get('application_form');
        data.application_date = toNullifEmpty(formData.get('application_date'));
        data.initial_cost = formData.get('initial_cost');

        const paymentStatus = formData.get('payment_status');
        data.payment_status = paymentStatus;
        const manualPaymentDate = formData.get('payment_date');

        if (manualPaymentDate) {
            data.payment_date = manualPaymentDate;
        } else if (paymentStatus === '完了' && !originalRaw.payment_date) {
            data.payment_date = new Date().toISOString().split('T')[0];
        } else if (paymentStatus === '未入金') {
            data.payment_date = null;
        } else {
            data.payment_date = originalRaw.payment_date;
        }
        data.payment_date = toNullifEmpty(data.payment_date);

        data.doc_consent = formData.get('doc_consent');
        data.doc_registry = formData.get('doc_registry');
        data.doc_resident = formData.get('doc_resident');
        data.email_arrival_date = toNullifEmpty(formData.get('email_arrival_date'));
        data.original_arrival_date = toNullifEmpty(formData.get('original_arrival_date'));
        data.login_info_sent_date = toNullifEmpty(formData.get('login_info_sent_date'));
        data.renewal_month = toNullifEmpty(formData.get('renewal_month'));
        data.remarks = formData.get('remarks');
        data.product_setting_plan = formData.get('product_setting_plan');
        data.not_purchased_list = formData.get('not_purchased_list');
        data.changed_during_activity = formData.get('changed_during_activity');
        data.shipping_date_entered = formData.get('shipping_date_entered');
        data.distinction = formData.get('distinction');

        return data;
    };

    const fetchStores = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('stores')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStores(data.map(mapStoreFromDB));
        } catch (err) {
            setError('データの取得に失敗しました: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const validData = results.data.filter(row => row.storeId && row.storeId !== '店舗ID' && row.storeId !== 'storeId');
                    const bulkData = validData.map(row => {
                        let mapped = {};

                        // Excelシリアル値を日付文字列(YYYY-MM-DD)に変換する関数
                        const excelDateToJSDate = (serial) => {
                            if (!serial || isNaN(serial)) return serial;
                            const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
                            return date.toISOString().split('T')[0];
                        };

                        const dateFields = [
                            'application_date', 'payment_date', 'email_arrival_date',
                            'original_arrival_date', 'login_info_sent_date'
                        ];

                        Object.keys(fieldMapping).forEach(csvKey => {
                            let value = row[csvKey];
                            if (value !== undefined && value !== null) {
                                const dbKey = fieldMapping[csvKey];

                                if (dateFields.includes(dbKey)) {
                                    // 日付型フィールドの正規化
                                    if (value === '' || value === '-' || value === '未定') {
                                        value = null;
                                    } else if (!isNaN(value) && value !== true && value !== false) {
                                        // 数値（Excelシリアル値）の場合の変換
                                        value = excelDateToJSDate(Number(value));
                                    } else if (typeof value === 'string' && value.includes('/')) {
                                        // "2024/01/01" 形式の変換
                                        const d = new Date(value);
                                        value = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
                                    } else {
                                        // それ以外の不正な形式（文字列など）をnullにする
                                        const d = new Date(value);
                                        if (isNaN(d.getTime())) value = null;
                                    }
                                }

                                mapped[dbKey] = value === '' ? null : value;
                            }
                        });
                        // Allow null store_id if not provided in CSV
                        if (!mapped.store_id) mapped.store_id = row.storeId || null;
                        return mapped;
                    });

                    if (bulkData.length === 0) {
                        alert('有効なデータが見つかりませんでした。');
                        return;
                    }

                    const { error } = await supabase.from('stores').upsert(bulkData, { onConflict: 'store_id' });
                    if (error) throw error;

                    alert(`${bulkData.length}件のデータをインポートしました。`);
                    fetchStores();
                } catch (err) {
                    alert('インポートに失敗しました: ' + err.message);
                } finally {
                    setIsLoading(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            },
            error: (err) => {
                alert('CSVの解析に失敗しました: ' + err.message);
                setIsLoading(false);
            }
        });
    };

    const getBadgeClass = (status) => {
        switch (status) {
            case '販売OK':
            case 'OK':
            case '完了':
            case '提出済み':
                return 'badge success';
            case '未申請':
                return 'badge warning';
            case '免除':
                return 'badge info'; // or something that looks neutral/good
            case '一時停止':
            case '未入金':
            case '未提出':
            case '未確認':
                return 'badge danger';
            default:
                return 'badge neutral';
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const now = new Date();
    const currentMonthStr = `${now.getMonth() + 1}月`;

    const sortedStores = [...stores].sort((a, b) => {
        const { key, direction } = sortConfig;
        if (key === 'documents') {
            const getDocPriority = (store) => {
                if (store.isDocComplete) return 3;
                if (store.documents.consent !== '未提出') return 2;
                return 1;
            };
            const priA = getDocPriority(a);
            const priB = getDocPriority(b);
            return direction === 'asc' ? priA - priB : priB - priA;
        }

        let valA = a[key] ?? '';
        let valB = b[key] ?? '';

        // 日付・タイムスタンプフィールドの数値的比較
        const dateKeys = ['dateSigned', 'paymentDate', 'emailArrivalDate', 'originalArrivalDate', 'loginInfoSentDate'];
        if (dateKeys.includes(key)) {
            const timeA = valA ? new Date(valA).getTime() : 0;
            const timeB = valB ? new Date(valB).getTime() : 0;
            return direction === 'asc' ? timeA - timeB : timeB - timeA;
        }

        // 数値フィールドの比較
        const numKeys = ['storeId', 'no', 'npSellerId', 'yearlyRenewalMonth'];
        if (numKeys.includes(key)) {
            const nA = parseInt(String(valA).replace(/\D/g, ''), 10) || 0;
            const nB = parseInt(String(valB).replace(/\D/g, ''), 10) || 0;
            return direction === 'asc' ? nA - nB : nB - nA;
        }

        // 文字列の比較 (日本語対応)
        const result = String(valA).localeCompare(String(valB), 'ja');
        return direction === 'asc' ? result : -result;
    });

    const filteredStores = sortedStores.filter(store => {
        const matchesSearch =
            store.storeName?.includes(searchTerm) ||
            store.representative?.includes(searchTerm) ||
            store.storeId?.includes(searchTerm) ||
            store.contactPerson?.includes(searchTerm);
        if (!matchesSearch) return false;
        if (filterMode === 'document-pending') return !store.isDocComplete;
        if (filterMode === 'renewal-current') {
            const isMatch = (val) => {
                if (!val || val === '-') return false;
                // 全角数字を半角に変換し、月やハイフンを処理して数値として比較
                const normalized = String(val)
                    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                    .replace(/月/g, '');
                let monthPart = normalized;
                if (normalized.includes('-')) {
                    const parts = normalized.split('-');
                    monthPart = parts[1] || parts[0];
                }
                return parseInt(monthPart, 10) === (now.getMonth() + 1);
            };
            // 管理対象（販売OK または 済み）かつ、いずれかの更新月フィールドが今月と一致
            const isActive = store.salesStatus === '販売OK' || store.salesStatus === '済み' || store.salesStatus === 'OK';
            // 表示と同じ複合ロジック（yearlyRenewal が空なら renewalMonth にフォールバック）も追加でチェック
            const displayVal = store.yearlyRenewal || store.renewalMonth;
            return isActive && (
                isMatch(displayVal) ||
                isMatch(store.yearly_renewal_legacy) ||
                isMatch(store.yearly_renewal_month) ||
                isMatch(store.renewal_month)
            );
        }
        if (filterMode === 'unpaid') return store.payment === '未入金';
        return true;
    });

    const openAddModal = () => { setEditingStore(null); setIsModalOpen(true); };
    const openEditModal = (store) => { setEditingStore(store); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setEditingStore(null); };

    // ダッシュボード上から販売ステータスを直接変更して即保存
    const handleInlineSalesStatus = async (storeId, newStatus) => {
        try {
            const { error } = await supabase
                .from('stores')
                .update({ sales_ok: newStatus })
                .eq('id', storeId);
            if (error) throw error;
            // ローカルのstateも即時反映（再フェッチなしで高速）
            setStores(prev => prev.map(s =>
                s.id === storeId ? { ...s, salesStatus: newStatus, raw: { ...s.raw, sales_ok: newStatus } } : s
            ));
        } catch (err) {
            alert('ステータスの更新に失敗しました: ' + err.message);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.target);
        const dbData = mapStoreToDB(formData, editingStore?.raw || {});
        const sId = dbData.store_id;
        try {
            let result;
            if (editingStore) {
                // Use the internal UUID 'id' to update, allowing 'store_id' to be changed
                result = await supabase.from('stores').update(dbData).eq('id', editingStore.raw.id);
            } else {
                result = await supabase.from('stores').insert([dbData]);
            }
            if (result.error) throw result.error;
            await fetchStores();
            closeModal();
        } catch (err) {
            alert('保存に失敗しました: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <header className="header">
                <h1>店舗管理ダッシュボード</h1>
                <button className="glass-btn" onClick={openAddModal} disabled={isLoading}>+ 新規追加</button>
            </header>

            {error && (
                <div className="error-message glass-panel" style={{ color: 'var(--danger-accent)', marginBottom: '20px', padding: '15px' }}>
                    <strong>エラーが発生しました:</strong><br /> {error}
                </div>
            )}

            <div className="stats-grid">
                <div className={`glass-panel stat-card clickable ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>
                    <h3>総店舗数</h3>
                    <div className="value">{isLoading && stores.length === 0 ? '-' : stores.length}</div>
                </div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'renewal-current' ? 'active' : ''}`} onClick={() => setFilterMode('renewal-current')}>
                    <h3>今月更新 ({currentMonthStr}・販売OK)</h3>
                    <div className="value">
                        {isLoading ? '-' : stores.filter(s => {
                            const isMatch = (val) => {
                                if (!val) return false;
                                const normalized = String(val)
                                    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                                    .replace(/月/g, '');
                                let monthPart = normalized;
                                if (normalized.includes('-')) {
                                    const parts = normalized.split('-');
                                    monthPart = parts[1] || parts[0];
                                }
                                return parseInt(monthPart, 10) === (now.getMonth() + 1);
                            };
                            const isActive = s.salesStatus === '販売OK' || s.salesStatus === '済み' || s.salesStatus === 'OK';
                            return isActive && (
                                isMatch(s.yearly_renewal_legacy) ||
                                isMatch(s.yearly_renewal_month) ||
                                isMatch(s.renewal_month)
                            );
                        }).length}
                    </div>
                </div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'document-pending' ? 'active' : ''}`} onClick={() => setFilterMode('document-pending')}>
                    <h3>書類未提出</h3>
                    <div className="value">{isLoading ? '-' : stores.filter(s => !s.isDocComplete).length}</div>
                </div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'unpaid' ? 'active' : ''}`} onClick={() => setFilterMode('unpaid')}>
                    <h3>未入金</h3>
                    <div className="value">{isLoading ? '-' : stores.filter(s => s.payment === '未入金').length}</div>
                </div>
            </div>

            <div className="glass-panel table-panel">
                <div className="controls-bar">
                    <input type="text" className="search-input" placeholder="店舗名・ID・代表者名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <button className="glass-btn secondary" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>CSVインポート</button>
                    <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('no')} className="sortable">No. {sortConfig.key === 'no' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('storeId')} className="sortable">ID {sortConfig.key === 'storeId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('salesStatus')} className="sortable">販売ステータス {sortConfig.key === 'salesStatus' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('storeName')} className="sortable">店舗名 {sortConfig.key === 'storeName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('representative')} className="sortable">代表者 {sortConfig.key === 'representative' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th>メール</th>
                                <th>パスワード</th>
                                <th>アクション</th>
                                <th onClick={() => handleSort('np_seller_id')} className="sortable">個人ID {sortConfig.key === 'np_seller_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStores.map(store => {
                                const copyKey = (field) => `${store.id}-${field}`;
                                const handleCopy = (text, field) => {
                                    if (!text) return;
                                    navigator.clipboard.writeText(text).then(() => {
                                        setCopiedCell(copyKey(field));
                                        setTimeout(() => setCopiedCell(null), 1500);
                                    });
                                };
                                return (
                                <tr key={store.id}>
                                    <td>{store.no}</td>
                                    <td>{store.storeId}</td>
                                    <td>
                                        <select
                                            value={store.salesStatus || '準備中'}
                                            onChange={(e) => handleInlineSalesStatus(store.id, e.target.value)}
                                            className={getBadgeClass(store.salesStatus)}
                                            style={{ 
                                                border: 'none', 
                                                background: 'transparent', 
                                                cursor: 'pointer', 
                                                fontWeight: '600', 
                                                fontSize: '0.8rem', 
                                                padding: '3px 6px', 
                                                borderRadius: '4px',
                                                color: store.classification === 'FD店舗' ? '#f97316'
                                                     : store.classification === '特別店舗' ? '#a855f7'
                                                     : '#333' // 通常は黒（濃いグレー）
                                            }}
                                        >
                                            <option value="準備中">準備中</option>
                                            <option value="未申請">未申請</option>
                                            <option value="販売OK">販売OK</option>
                                            <option value="一時停止">一時停止</option>
                                            <option value="退会">退会</option>
                                            {store.salesStatus === 'OK' && <option value="OK">OK（旧）</option>}
                                            {store.salesStatus === '済み' && <option value="済み">済み（旧）</option>}
                                        </select>
                                    </td>
                                    <td>
                                        <strong style={{
                                            color: store.classification === 'FD店舗' ? '#f97316'
                                                 : store.classification === '特別店舗' ? '#a855f7'
                                                 : 'inherit',
                                            textShadow: store.classification === '特別店舗' ? '0 0 8px rgba(168,85,247,0.5)' : 'none'
                                        }}>
                                            {store.storeName}
                                        </strong>
                                    </td>
                                    <td>{store.representative}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className="action-btn"
                                            style={{ fontSize: '0.75rem', padding: '4px 10px', minWidth: '80px', background: copiedCell === copyKey('email') ? 'var(--success-accent, #22c55e)' : '' }}
                                            onClick={() => handleCopy(store.email, 'email')}
                                            title={store.email || 'メールなし'}
                                            disabled={!store.email}
                                        >
                                            {copiedCell === copyKey('email') ? '✓ コピー済み' : '📋 コピー'}
                                        </button>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className="action-btn"
                                            style={{ fontSize: '0.75rem', padding: '4px 10px', minWidth: '80px', background: copiedCell === copyKey('password') ? 'var(--success-accent, #22c55e)' : '' }}
                                            onClick={() => handleCopy(store.password, 'password')}
                                            title={store.password ? '••••••' : 'パスワードなし'}
                                            disabled={!store.password}
                                        >
                                            {copiedCell === copyKey('password') ? '✓ コピー済み' : '📋 コピー'}
                                        </button>
                                    </td>
                                    <td><button className="action-btn edit-btn" onClick={() => openEditModal(store)}>詳細・編集</button></td>
                                    <td>{store.np_seller_id || '-'}</td>
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
                        <h2>{editingStore ? '店舗情報の編集' : '新規店舗の追加'}</h2>
                        <form onSubmit={handleSave} className="modal-form">
                            <div className="modal-scroll-area">
                                <section>
                                    <h3>基本情報</h3>
                                    <div className="form-grid">
                                        <div className="form-group"><label>店舗ID</label><input type="text" name="store_id" defaultValue={editingStore?.store_id || ''} /></div>
                                        <div className="form-group"><label>No</label><input type="text" name="no" defaultValue={editingStore?.no || ''} /></div>
                                        <div className="form-group"><label>店舗名</label><input type="text" name="store_name" required defaultValue={editingStore?.store_name || ''} /></div>
                                        <div className="form-group"><label>法人名</label><input type="text" name="corporate_name" defaultValue={editingStore?.corporate_name || ''} /></div>
                                        <div className="form-group"><label>代表者名</label><input type="text" name="representative" required defaultValue={editingStore?.representative || ''} /></div>
                                        <div className="form-group"><label>担当者名</label><input type="text" name="contact_person" defaultValue={editingStore?.contact_person || ''} /></div>
                                        <div className="form-group"><label>メールアドレス</label><input type="email" name="email" defaultValue={editingStore?.email || ''} /></div>
                                        <div className="form-group"><label>パスワード</label><input type="text" name="password" defaultValue={editingStore?.password || ''} /></div>
                                        <div className="form-group">
                                            <label>個人会員ID</label>
                                            <input
                                                type="text"
                                                name="np_seller_id"
                                                defaultValue={editingStore?.raw?.np_seller_id || ''}
                                                placeholder="例: 65813301"
                                            />
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h3>ステータス・進捗</h3>
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>販売ステータス</label>
                                            <select name="sales_ok" defaultValue={editingStore?.raw?.sales_ok || '準備中'}>
                                                <option value="準備中">準備中</option>
                                                <option value="未申請">未申請</option>
                                                <option value="退会">退会</option>
                                                <option value="販売OK">販売OK</option>
                                                <option value="一時停止">一時停止</option>
                                                {/* 旧データ互換用（DBに古い値が入っている場合に上書きされないよう保持） */}
                                                {editingStore?.raw?.sales_ok === 'OK' && <option value="OK">OK（旧形式）</option>}
                                                {editingStore?.raw?.sales_ok === '済み' && <option value="済み">済み（旧形式）</option>}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>区別</label>
                                            <select
                                                name="distinction"
                                                defaultValue={editingStore?.raw?.distinction || '通常'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'FD店舗' || val === '特別店舗') {
                                                        const paymentSelect = e.target.form.elements.payment_status;
                                                        if (paymentSelect) paymentSelect.value = '免除';
                                                    }
                                                }}
                                            >
                                                <option value="通常">通常</option>
                                                <option value="FD店舗">FD店舗</option>
                                                <option value="特別店舗">特別店舗</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>入金状況</label>
                                            <select name="payment_status" defaultValue={editingStore?.raw?.payment_status || editingStore?.payment || '未入金'}>
                                                <option value="完了">完了</option>
                                                <option value="免除">免除</option>
                                                <option value="未入金">未入金</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>同意書</label>
                                            <select name="doc_consent" defaultValue={editingStore?.raw?.doc_consent || '未提出'}>
                                                <option value="提出済み">提出済み</option>
                                                <option value="原本のみ">原本のみ</option>
                                                <option value="電子のみ">電子のみ</option>
                                                <option value="未確認">未確認</option>
                                                <option value="未提出">未提出</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>登記簿謄本</label>
                                            <select name="doc_registry" defaultValue={editingStore?.raw?.doc_registry || '未提出'}>
                                                <option value="提出済み">提出済み</option>
                                                <option value="原本のみ">原本のみ</option>
                                                <option value="電子のみ">電子のみ</option>
                                                <option value="未確認">未確認</option>
                                                <option value="未提出">未提出</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>住民票</label>
                                            <select name="doc_resident" defaultValue={editingStore?.raw?.doc_resident || '未提出'}>
                                                <option value="提出済み">提出済み</option>
                                                <option value="原本のみ">原本のみ</option>
                                                <option value="電子のみ">電子のみ</option>
                                                <option value="未確認">未確認</option>
                                                <option value="未提出">未提出</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h3>契約・プラン・日付</h3>
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>契約プラン</label>
                                            <select name="initial_plan" defaultValue={editingStore?.initial_plan || ''}>
                                                <option value="">未設定</option>
                                                <option value="FD30品目プラン">FD30品目プラン</option>
                                                <option value="10品目プラン">10品目プラン</option>
                                                <option value="30品目プラン">30品目プラン</option>
                                                <option value="50品目プラン">50品目プラン</option>
                                                <option value="無制限プラン">無制限プラン</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>プラン追加</label>
                                            <select name="plan_addition" defaultValue={editingStore?.raw?.plan_addition || 'なし'}>
                                                <option value="なし">なし</option>
                                                <option value="追加20品目">追加20品目</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>申請フォーム受理日</label><input type="date" name="application_date" defaultValue={editingStore?.application_date ? editingStore.application_date.slice(0, 10) : ''} /></div>
                                        <div className="form-group"><label>契約締結日（ログイン情報送付日）</label><input type="date" name="login_info_sent_date" defaultValue={editingStore?.raw?.login_info_sent_date ? editingStore.raw.login_info_sent_date.slice(0, 10) : ''} /></div>
                                        <div className="form-group"><label>入金日</label><input type="date" name="payment_date" defaultValue={editingStore?.raw?.payment_date ? editingStore.raw.payment_date.slice(0, 10) : ''} /></div>
                                        <div className="form-group">
                                            <label>年間契約更新状況</label>
                                            <select name="yearly_renewal_legacy" defaultValue={editingStore?.yearly_renewal_legacy || ''}>
                                                <option value="">未設定</option>
                                                <option value="2026年支払済">2026年支払済</option>
                                                <option value="2027年支払済">2027年支払済</option>
                                                <option value="2028年支払済">2028年支払済</option>
                                                <option value="2029年支払済">2029年支払済</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>更新月</label>
                                            <select name="renewal_month" defaultValue={editingStore?.raw?.renewal_month || ''}>
                                                <option value="">未設定</option>
                                                <option value="1">1月</option>
                                                <option value="2">2月</option>
                                                <option value="3">3月</option>
                                                <option value="4">4月</option>
                                                <option value="5">5月</option>
                                                <option value="6">6月</option>
                                                <option value="7">7月</option>
                                                <option value="8">8月</option>
                                                <option value="9">9月</option>
                                                <option value="10">10月</option>
                                                <option value="11">11月</option>
                                                <option value="12">12月</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h3>その他・備考</h3>
                                    <div className="form-group full-width"><label>備考</label><textarea name="remarks" defaultValue={editingStore?.remarks || ''}></textarea></div>
                                </section>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="action-btn cancel-btn" onClick={closeModal}>キャンセル</button>
                                <button type="submit" className="glass-btn">{isLoading ? '保存中...' : '保存する'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default StoreManagement;
