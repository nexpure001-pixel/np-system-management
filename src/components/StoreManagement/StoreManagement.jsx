import { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import Papa from 'papaparse';

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
    const fileInputRef = useRef(null);

    // データ表示用のキーに変換 (Firestore -> UI)
    const mapStoreFromDB = (item) => {
        // 「【両方済み】」または従来の「提出済み」の両方を正解として、段階的に移行をサポート
        const isCompleted = (val) => val === '【両方済み】' || val === '提出済み' || val === '両方完了';
        
        const hasConsent = isCompleted(item.doc_consent) || item.doc_consent === '電子のみ' || item.doc_consent === '原本のみ';
        const hasRegistry = isCompleted(item.doc_registry) || item.doc_registry === '原本のみ' || item.doc_registry === '電子のみ';
        const hasResident = isCompleted(item.doc_resident) || item.doc_resident === '原本のみ' || item.doc_resident === '電子のみ';
        const isDocComplete = hasConsent && (hasRegistry || hasResident);

        const dist = item.distinction;
        const isSpecial = dist?.includes('特別');
        const isFounding = dist === 'FD店舗' || item.initial_plan?.includes('ファウンディング') || item.initial_plan?.includes('FD');
        
        let classification = '通常店舗';
        if (dist === '通常' || dist === '通常店舗') {
            classification = '通常店舗';
        } else if (isSpecial) {
            classification = '特別店舗';
        } else if (isFounding) {
            classification = 'FD店舗';
        }

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

    const fetchStores = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const snapshot = await getDocs(collection(db, 'stores'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

    const handleInlineSalesStatus = async (id, newStatus) => {
        try {
            const docRef = doc(db, 'stores', id);
            await updateDoc(docRef, { sales_ok: newStatus });
            setStores(prev => prev.map(s =>
                s.id === id ? { ...s, salesStatus: newStatus, raw: { ...s.raw, sales_ok: newStatus } } : s
            ));
        } catch (err) {
            alert('ステータスの更新に失敗しました: ' + err.message);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.target);
        
        const dbData = {
            store_id: formData.get('store_id'),
            no: formData.get('no'),
            store_name: formData.get('store_name'),
            corporate_name: formData.get('corporate_name'),
            representative: formData.get('representative'),
            contact_person: formData.get('contact_person'),
            email: formData.get('email'),
            password: formData.get('password'),
            np_seller_id: formData.get('np_seller_id'),
            sales_ok: formData.get('sales_ok'),
            distinction: formData.get('distinction'),
            payment_status: formData.get('payment_status'),
            doc_consent: formData.get('doc_consent'),
            doc_registry: formData.get('doc_registry'),
            doc_resident: formData.get('doc_resident'),
            initial_plan: formData.get('initial_plan'),
            plan_addition: formData.get('plan_addition'),
            application_date: formData.get('application_date') || null,
            login_info_sent_date: formData.get('login_info_sent_date') || null,
            payment_date: formData.get('payment_date') || null,
            renewal_month: formData.get('renewal_month') || null,
            yearly_renewal_legacy: formData.get('yearly_renewal_legacy') || '',
            remarks: formData.get('remarks') || '',
            updated_at: new Date().toISOString()
        };

        try {
            if (editingStore) {
                await setDoc(doc(db, 'stores', editingStore.id), dbData, { merge: true });
            } else {
                await addDoc(collection(db, 'stores'), { ...dbData, created_at: new Date().toISOString() });
            }
            await fetchStores();
            setIsModalOpen(false);
            setEditingStore(null);
        } catch (err) {
            alert('保存に失敗しました: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getBadgeClass = (status) => {
        switch (status) {
            case '販売OK': case 'OK': case '完了': case '【両方済み】': return 'badge success';
            case '未申請': return 'badge warning';
            case '免除': return 'badge info';
            case '一時停止': case '未入金': case '未提出': case '未確認': return 'badge danger';
            default: return 'badge neutral';
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const now = new Date();
    const currentMonthStr = `${now.getMonth() + 1}月`;

    const sortedStores = [...stores].sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA = a[key] ?? '';
        let valB = b[key] ?? '';
        if (key === 'no' || key === 'storeId') {
            const nA = parseInt(String(valA).replace(/\D/g, ''), 10) || 0;
            const nB = parseInt(String(valB).replace(/\D/g, ''), 10) || 0;
            return direction === 'asc' ? nA - nB : nB - nA;
        }
        return direction === 'asc' ? String(valA).localeCompare(String(valB), 'ja') : String(valB).localeCompare(String(valA), 'ja');
    });

    const filteredStores = sortedStores.filter(store => {
        const matchesSearch = store.storeName?.includes(searchTerm) || store.representative?.includes(searchTerm) || store.storeId?.includes(searchTerm);
        if (!matchesSearch) return false;
        if (filterMode === 'document-pending') return !store.isDocComplete;
        if (filterMode === 'unpaid') return store.payment === '未入金';
        return true;
    });

    return (
        <>
            <header className="header">
                <h1>店舗管理ダッシュボード</h1>
                <button className="glass-btn" onClick={() => { setEditingStore(null); setIsModalOpen(true); }} disabled={isLoading}>+ 新規追加</button>
            </header>

            <div className="stats-grid">
                <div className={`glass-panel stat-card clickable ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>
                    <h3>総店舗数</h3>
                    <div className="value">{stores.length}</div>
                </div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'renewal-current' ? 'active' : ''}`} onClick={() => setFilterMode('renewal-current')}>
                    <h3>今月更新 ({currentMonthStr}・販売OK)</h3>
                    <div className="value">{stores.filter(s => s.salesStatus === '販売OK' && parseInt(s.renewalMonth) === (now.getMonth() + 1)).length}</div>
                </div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'document-pending' ? 'active' : ''}`} onClick={() => setFilterMode('document-pending')}>
                    <h3>書類未提出</h3>
                    <div className="value">{stores.filter(s => !s.isDocComplete).length}</div>
                </div>
                <div className={`glass-panel stat-card clickable ${filterMode === 'unpaid' ? 'active' : ''}`} onClick={() => setFilterMode('unpaid')}>
                    <h3>未入金</h3>
                    <div className="value">{stores.filter(s => s.payment === '未入金').length}</div>
                </div>
            </div>

            <div className="glass-panel table-panel">
                <div className="controls-bar">
                    <input type="text" className="search-input" placeholder="店舗名・ID・代表者名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('no')} className="sortable">No.</th>
                                <th onClick={() => handleSort('storeId')} className="sortable">ID</th>
                                <th onClick={() => handleSort('salesStatus')} className="sortable">販売ステータス</th>
                                <th onClick={() => handleSort('storeName')} className="sortable">店舗名</th>
                                <th onClick={() => handleSort('representative')} className="sortable">代表者</th>
                                <th>メール</th>
                                <th>パスワード</th>
                                <th>アクション</th>
                                <th onClick={() => handleSort('np_seller_id')} className="sortable">個人ID</th>
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
                                                    border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', padding: '3px 6px', borderRadius: '4px',
                                                    color: store.classification === 'FD店舗' ? '#f97316' : store.classification === '特別店舗' ? '#a855f7' : '#333'
                                                }}
                                            >
                                                <option value="準備中">準備中</option>
                                                <option value="未申請">未申請</option>
                                                <option value="販売OK">販売OK</option>
                                                <option value="一時停止">一時停止</option>
                                                <option value="退会">退会</option>
                                            </select>
                                        </td>
                                        <td>
                                            <strong style={{
                                                color: store.classification === 'FD店舗' ? '#f97316' : store.classification === '特別店舗' ? '#a855f7' : 'inherit',
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
                                                disabled={!store.password}
                                            >
                                                {copiedCell === copyKey('password') ? '✓ コピー済み' : '📋 コピー'}
                                            </button>
                                        </td>
                                        <td><button className="action-btn edit-btn" onClick={() => { setEditingStore(store); setIsModalOpen(true); }}>詳細・編集</button></td>
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
                                        <div className="form-group"><label>店舗ID</label><input type="text" name="store_id" defaultValue={editingStore?.storeId || ''} /></div>
                                        <div className="form-group"><label>No</label><input type="text" name="no" defaultValue={editingStore?.no || ''} /></div>
                                        <div className="form-group"><label>店舗名</label><input type="text" name="store_name" required defaultValue={editingStore?.storeName || ''} /></div>
                                        <div className="form-group"><label>法人名</label><input type="text" name="corporate_name" defaultValue={editingStore?.corporateName || ''} /></div>
                                        <div className="form-group"><label>代表者名</label><input type="text" name="representative" required defaultValue={editingStore?.representative || ''} /></div>
                                        <div className="form-group"><label>担当者名</label><input type="text" name="contact_person" defaultValue={editingStore?.contactPerson || ''} /></div>
                                        <div className="form-group"><label>メールアドレス</label><input type="email" name="email" defaultValue={editingStore?.email || ''} /></div>
                                        <div className="form-group"><label>パスワード</label><input type="text" name="password" defaultValue={editingStore?.password || ''} /></div>
                                        <div className="form-group"><label>個人会員ID</label><input type="text" name="np_seller_id" defaultValue={editingStore?.np_seller_id || ''} /></div>
                                    </div>
                                </section>
                                <section>
                                    <h3>ステータス・進捗</h3>
                                    <div className="form-grid">
                                        <div className="form-group"><label>販売ステータス</label>
                                            <select name="sales_ok" defaultValue={editingStore?.raw?.sales_ok || '準備中'}>
                                                <option value="準備中">準備中</option><option value="未申請">未申請</option><option value="販売OK">販売OK</option><option value="一時停止">一時停止</option><option value="退会">退会</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>区別</label>
                                            <select name="distinction" defaultValue={editingStore?.raw?.distinction || '通常'}>
                                                <option value="通常">通常</option><option value="FD店舗">FD店舗</option><option value="特別店舗">特別店舗</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>入金状況</label>
                                            <select name="payment_status" defaultValue={editingStore?.raw?.payment_status || '未入金'}>
                                                <option value="完了">完了</option><option value="免除">免除</option><option value="未入金">未入金</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>同意書</label>
                                            <select name="doc_consent" defaultValue={editingStore?.raw?.doc_consent || '未提出'}>
                                                <option value="【両方済み】">【両方済み】</option><option value="原本のみ">原本のみ</option><option value="電子のみ">電子のみ</option><option value="不要">不要</option><option value="未提出">未提出</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>登記簿謄本</label>
                                            <select name="doc_registry" defaultValue={editingStore?.raw?.doc_registry || '未提出'}>
                                                <option value="【両方済み】">【両方済み】</option><option value="原本のみ">原本のみ</option><option value="電子のみ">電子のみ</option><option value="不要">不要</option><option value="未提出">未提出</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>住民票</label>
                                            <select name="doc_resident" defaultValue={editingStore?.raw?.doc_resident || '未提出'}>
                                                <option value="【両方済み】">【両方済み】</option><option value="原本のみ">原本のみ</option><option value="電子のみ">電子のみ</option><option value="不要">不要</option><option value="未提出">未提出</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h3>契約・更新</h3>
                                    <div className="form-grid">
                                        <div className="form-group"><label>契約プラン</label><input type="text" name="initial_plan" defaultValue={editingStore?.plan || ''} /></div>
                                        <div className="form-group"><label>更新月</label>
                                            <select name="renewal_month" defaultValue={editingStore?.raw?.renewal_month || ''}>
                                                <option value="">未設定</option>
                                                {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group"><label>申請日</label><input type="date" name="application_date" defaultValue={editingStore?.dateSigned || ''} /></div>
                                        <div className="form-group"><label>入金日</label><input type="date" name="payment_date" defaultValue={editingStore?.paymentDate || ''} /></div>
                                    </div>
                                </section>
                                <section>
                                    <h3>その他・備考</h3>
                                    <div className="form-group full-width"><textarea name="remarks" defaultValue={editingStore?.remarks || ''}></textarea></div>
                                </section>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="action-btn cancel-btn" onClick={() => setIsModalOpen(false)}>キャンセル</button>
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
