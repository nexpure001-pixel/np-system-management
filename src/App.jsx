import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import './App.css';

function App() {
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'document-pending', 'renewal-current', 'unpaid'
  const [sortConfig, setSortConfig] = useState({ key: 'storeId', direction: 'asc' });
  const fileInputRef = useRef(null);

  // フィールドマッピング定義 (CSV -> DB)
  const fieldMapping = {
    salesOk: 'sales_ok',
    yearlyRenewal: 'yearly_renewal_legacy',
    yearlyRenewalMonth: 'yearly_renewal_month',
    no: 'no',
    npSellerId: 'np_seller_id',
    introducer: 'introducer',
    storeId: 'store_id',
    storeName: 'store_name',
    corporateName: 'corporate_name',
    representative: 'representative',
    contactPerson: 'contact_person',
    email: 'email',
    password: 'password',
    initialPlan: 'initial_plan',
    planAddition: 'plan_addition',
    applicationForm: 'application_form',
    applicationDate: 'application_date',
    initialCost: 'initial_cost',
    paymentDate: 'payment_date',
    docConsent: 'doc_consent',
    docRegistry: 'doc_registry',
    docResident: 'doc_resident',
    emailArrivalDate: 'email_arrival_date',
    originalArrivalDate: 'original_arrival_date',
    loginInfoSentDate: 'login_info_sent_date',
    renewalMonth: 'renewal_month',
    remarks: 'remarks',
    productSettingPlan: 'product_setting_plan',
    notPurchasedList: 'not_purchased_list',
    changedDuringActivity: 'changed_during_activity',
    shippingDateEntered: 'shipping_date_entered'
  };

  // データ表示用のキーに変換 (DB -> UI)
  const mapStoreFromDB = (item) => {
    // 書類判定: 同意書必須 + (登記簿 or 住民票)
    const hasConsent = item.doc_consent === '提出済み' || item.doc_consent === '両方完了';
    const hasRegistry = item.doc_registry === '提出済み' || item.doc_registry === '両方完了' || item.doc_registry === '原本のみ';
    const hasResident = item.doc_resident === '提出済み' || item.doc_resident === '両方完了' || item.doc_resident === '原本のみ';
    const isDocComplete = hasConsent && (hasRegistry || hasResident);

    // 区分判定 (FD or 新規)
    const isFD = item.initial_plan?.includes('ファウンディング');
    const isNew = item.application_date && item.application_date >= '2025-03-01';

    return {
      ...item,
      storeId: item.store_id || '',
      storeName: item.store_name || '',
      corporateName: item.corporate_name || '',
      representative: item.representative || '',
      contactPerson: item.contact_person || '',
      email: item.email || '',
      password: item.password || '',
      plan: item.initial_plan || '',
      dateSigned: item.application_date || '',
      salesStatus: item.sales_ok || '準備中',
      yearlyRenewal: item.yearly_renewal_legacy || '',
      payment: item.payment_date ? '完了' : '未入金',
      isDocComplete,
      classification: isFD ? 'FD店舗' : (isNew ? '新規店舗' : '-'),
      documents: {
        consent: item.doc_consent || '未提出',
        registry: item.doc_registry || '未提出',
        residentCard: item.doc_resident || '未提出',
      },
      raw: item
    };
  };

  // DB保存用の形式に変換 (UI -> DB)
  const mapStoreToDB = (formData, originalRaw = {}) => {
    const data = { ...originalRaw };

    // 全32フィールドのマッピング
    data.sales_ok = formData.get('sales_ok');
    data.yearly_renewal_legacy = formData.get('yearly_renewal_legacy');
    data.yearly_renewal_month = formData.get('yearly_renewal_month');
    data.no = formData.get('no');
    data.np_seller_id = formData.get('np_seller_id');
    data.introducer = formData.get('introducer');
    data.store_id = formData.get('store_id') || data.store_id || Math.floor(10000000 + Math.random() * 90000000).toString();
    data.store_name = formData.get('store_name');
    data.corporate_name = formData.get('corporate_name');
    data.representative = formData.get('representative');
    data.contact_person = formData.get('contact_person');
    data.email = formData.get('email');
    data.password = formData.get('password');
    data.initial_plan = formData.get('initial_plan');
    data.plan_addition = formData.get('plan_addition');
    data.application_form = formData.get('application_form');
    data.application_date = formData.get('application_date');
    data.initial_cost = formData.get('initial_cost');

    const paymentStatus = formData.get('payment_status'); // 画面上のセレクトボックス
    if (paymentStatus === '完了' && !data.payment_date) {
      data.payment_date = new Date().toISOString();
    } else if (paymentStatus === '未入金') {
      data.payment_date = null;
    }

    data.doc_consent = formData.get('doc_consent');
    data.doc_registry = formData.get('doc_registry');
    data.doc_resident = formData.get('doc_resident');
    data.email_arrival_date = formData.get('email_arrival_date');
    data.original_arrival_date = formData.get('original_arrival_date');
    data.login_info_sent_date = formData.get('login_info_sent_date');
    data.renewal_month = formData.get('renewal_month');
    data.remarks = formData.get('remarks');
    data.product_setting_plan = formData.get('product_setting_plan');
    data.not_purchased_list = formData.get('not_purchased_list');
    data.changed_during_activity = formData.get('changed_during_activity');
    data.shipping_date_entered = formData.get('shipping_date_entered');

    return data;
  };

  // データ取得 (Supabase)
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

  // CSVインポート処理
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // ヘッダー行がデータとして混じっている場合は除外 (販売OKなどが含まれる行をスキップ)
          const validData = results.data.filter(row => row.storeId && row.storeId !== '店舗ID' && row.storeId !== 'storeId');

          const bulkData = validData.map(row => {
            let mapped = {};
            Object.keys(fieldMapping).forEach(csvKey => {
              if (row[csvKey] !== undefined) {
                mapped[fieldMapping[csvKey]] = row[csvKey];
              }
            });
            // storeId が必須
            if (!mapped.store_id) mapped.store_id = row.storeId || Math.random().toString(36).substr(2, 9);
            return mapped;
          });

          if (bulkData.length === 0) {
            alert('有効なデータが見つかりませんでした。');
            return;
          }

          // Supabase に一括挿入 (upsertを使用)
          const { error } = await supabase
            .from('stores')
            .upsert(bulkData, { onConflict: 'store_id' });

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

  // 並び替えロジック
  const sortedStores = [...stores].sort((a, b) => {
    const { key, direction } = sortConfig;

    // 書類ステータスのカスタム並び替え
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

    // 数値比較 (ID, Noなど)
    if (key === 'storeId' || key === 'no') {
      const numA = parseInt(valA, 10) || 0;
      const numB = parseInt(valB, 10) || 0;
      return direction === 'asc' ? numA - numB : numB - numA;
    }

    // 日付比較 (申込日, 入金日など)
    if (key === 'applicationDate' || key === 'paymentDate' || key === 'emailArrivalDate') {
      const dateA = valA ? new Date(valA).getTime() : 0;
      const dateB = valB ? new Date(valB).getTime() : 0;
      return direction === 'asc' ? dateA - dateB : dateB - dateA;
    }

    // 文字列の比較 (日本語対応)
    const result = String(valA).localeCompare(String(valB), 'ja');
    return direction === 'asc' ? result : -result;
  });

  const filteredStores = sortedStores.filter(store => {
    // 検索語フィルター
    const matchesSearch =
      store.storeName?.includes(searchTerm) ||
      store.representative?.includes(searchTerm) ||
      store.storeId?.includes(searchTerm) ||
      store.contactPerson?.includes(searchTerm);

    if (!matchesSearch) return false;

    // ステータスフィルター
    if (filterMode === 'document-pending') {
      return !store.isDocComplete;
    }
    if (filterMode === 'renewal-current') {
      // 厳密な判定: "1月" が "11月" に含まれないようにする
      return store.salesStatus === '販売OK' && store.yearlyRenewal === currentMonthStr;
    }
    if (filterMode === 'unpaid') {
      return store.payment === '未入金';
    }

    return true;
  });

  const openAddModal = () => {
    setEditingStore(null);
    setIsModalOpen(true);
  };

  const openEditModal = (store) => {
    setEditingStore(store);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStore(null);
  };

  // データ保存 (Supabase)
  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.target);
    const dbData = mapStoreToDB(formData, editingStore?.raw || {});
    const sId = dbData.store_id;

    try {
      let result;
      if (editingStore) {
        // 更新
        result = await supabase
          .from('stores')
          .update(dbData)
          .eq('store_id', sId);
      } else {
        // 新規作成
        result = await supabase
          .from('stores')
          .insert([dbData]);
      }

      if (result.error) throw result.error;

      // 保存成功後、最新データを再取得
      await fetchStores();
      closeModal();
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>店舗管理 Dashboard</h1>
        <button className="glass-btn" onClick={openAddModal} disabled={isLoading}>+ 新規追加</button>
      </header>

      {error && (
        <div className="error-message glass-panel" style={{ color: 'var(--danger-accent)', marginBottom: '20px', padding: '15px' }}>
          <strong>エラーが発生しました:</strong><br />
          {error}
          <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
            ※Supabaseの環境変数が設定されているか確認してください。
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div
          className={`glass-panel stat-card clickable ${filterMode === 'all' ? 'active' : ''}`}
          onClick={() => setFilterMode('all')}
        >
          <h3>総店舗数</h3>
          <div className="value">{isLoading && stores.length === 0 ? '-' : stores.length}</div>
        </div>
        <div
          className={`glass-panel stat-card clickable ${filterMode === 'renewal-current' ? 'active' : ''}`}
          onClick={() => setFilterMode('renewal-current')}
        >
          <h3>今月更新 ({currentMonthStr}・販売OK)</h3>
          <div className="value">
            {isLoading ? '-' : stores.filter(s => s.salesStatus === '販売OK' && s.yearlyRenewal === currentMonthStr).length}
          </div>
        </div>
        <div
          className={`glass-panel stat-card clickable ${filterMode === 'document-pending' ? 'active' : ''}`}
          onClick={() => setFilterMode('document-pending')}
        >
          <h3>書類未提出</h3>
          <div className="value">
            {isLoading ? '-' : stores.filter(s => !s.isDocComplete).length}
          </div>
        </div>
        <div
          className={`glass-panel stat-card clickable ${filterMode === 'unpaid' ? 'active' : ''}`}
          onClick={() => setFilterMode('unpaid')}
        >
          <h3>未入金</h3>
          <div className="value">
            {isLoading ? '-' : stores.filter(s => s.payment === '未入金').length}
          </div>
        </div>
      </div>

      <div className="glass-panel table-panel">
        <div className="controls-bar">
          <input
            type="text"
            className="search-input"
            placeholder="店舗名・ID・代表者名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
          />
          <button className="glass-btn secondary" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            CSVインポート
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            style={{ display: 'none' }}
          />
        </div>

        <div className="table-container">
          {isLoading && stores.length === 0 ? (
            <div className="empty-state">データを読み込み中...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('storeId')} className="sortable">ID {sortConfig.key === 'storeId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('classification')} className="sortable">区別する {sortConfig.key === 'classification' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('storeName')} className="sortable">店舗名 / 法人名 {sortConfig.key === 'storeName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('representative')} className="sortable">代表者・担当者 {sortConfig.key === 'representative' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('email')} className="sortable">メール/パス {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('salesStatus')} className="sortable">販売ステータス {sortConfig.key === 'salesStatus' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('plan')} className="sortable">プラン {sortConfig.key === 'plan' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('paymentDate')} className="sortable">入金日 {sortConfig.key === 'paymentDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('documents')} className="sortable">書類提出 {sortConfig.key === 'documents' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('yearlyRenewal')} className="sortable">更新月 {sortConfig.key === 'yearlyRenewal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th>アクション</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map(store => (
                  <tr key={store.storeId}>
                    <td>{store.storeId}</td>
                    <td><span className={`badge ${store.classification === 'FD店舗' ? 'success' : (store.classification === '新規店舗' ? 'warning' : 'neutral')}`}>{store.classification}</span></td>
                    <td style={{ minWidth: '240px' }}>
                      <strong>{store.storeName}</strong>
                      {store.corporateName && <span style={{ opacity: 0.7, marginLeft: '8px', fontSize: '0.85rem' }}>({store.corporateName})</span>}
                    </td>
                    <td>
                      {store.representative}
                      {store.contactPerson && <span style={{ color: 'var(--primary-accent)', marginLeft: '8px', fontSize: '0.85rem' }}>(担: {store.contactPerson})</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>{store.email || '-'}</span>
                      {store.password && <span style={{ opacity: 0.6, marginLeft: '8px', fontSize: '0.85rem' }}>[{store.password}]</span>}
                    </td>
                    <td><span className={getBadgeClass(store.salesStatus)}>{store.salesStatus}</span></td>
                    <td>{store.plan}</td>
                    <td>{store.paymentDate ? new Date(store.paymentDate).toLocaleDateString('ja-JP') : '未確認'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={getBadgeClass(store.documents?.consent)} style={{ padding: '4px 8px' }}>同意書: {store.documents?.consent}</span>
                        <span className={getBadgeClass(store.isDocComplete ? '提出済み' : '未提出')} style={{ padding: '4px 8px' }}>
                          {store.isDocComplete ? '完備' : '不足'}
                        </span>
                      </div>
                    </td>
                    <td>{store.yearlyRenewal}</td>
                    <td>
                      <button className="action-btn edit-btn" onClick={() => openEditModal(store)}>詳細・編集</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && filteredStores.length === 0 && !error && (
            <div className="empty-state">該当する店舗が見つからないか、データがありません。</div>
          )}
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
                    <div className="form-group">
                      <label>店舗ID</label>
                      <input type="text" name="store_id" readOnly={!!editingStore} defaultValue={editingStore?.store_id || ''} placeholder="自動生成されます" />
                    </div>
                    <div className="form-group">
                      <label>No</label>
                      <input type="text" name="no" defaultValue={editingStore?.no || ''} />
                    </div>
                    <div className="form-group">
                      <label>店舗名</label>
                      <input type="text" name="store_name" required defaultValue={editingStore?.store_name || ''} />
                    </div>
                    <div className="form-group">
                      <label>法人名</label>
                      <input type="text" name="corporate_name" defaultValue={editingStore?.corporate_name || ''} />
                    </div>
                    <div className="form-group">
                      <label>代表者名</label>
                      <input type="text" name="representative" required defaultValue={editingStore?.representative || ''} />
                    </div>
                    <div className="form-group">
                      <label>担当者名</label>
                      <input type="text" name="contact_person" defaultValue={editingStore?.contact_person || ''} />
                    </div>
                    <div className="form-group">
                      <label>メールアドレス</label>
                      <input type="email" name="email" defaultValue={editingStore?.email || ''} />
                    </div>
                    <div className="form-group">
                      <label>パスワード</label>
                      <input type="text" name="password" defaultValue={editingStore?.password || ''} />
                    </div>
                  </div>
                </section>

                <section>
                  <h3>ステータス・進捗</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>販売ステータス</label>
                      <input type="text" name="sales_ok" defaultValue={editingStore?.sales_ok || '準備中'} list="sales-status-options" />
                      <datalist id="sales-status-options">
                        <option value="販売OK" />
                        <option value="一時停止" />
                        <option value="準備中" />
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label>入金状況</label>
                      <select name="payment_status" defaultValue={editingStore?.payment || '未入金'}>
                        <option value="完了">完了</option>
                        <option value="未入金">未入金</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>同意書</label>
                      <input type="text" name="doc_consent" defaultValue={editingStore?.doc_consent || '未提出'} list="doc-status-options" />
                    </div>
                    <div className="form-group">
                      <label>登記簿謄本</label>
                      <input type="text" name="doc_registry" defaultValue={editingStore?.doc_registry || '未提出'} list="doc-status-options" />
                    </div>
                    <div className="form-group">
                      <label>住民票</label>
                      <input type="text" name="doc_resident" defaultValue={editingStore?.doc_resident || '未提出'} list="doc-status-options" />
                      <datalist id="doc-status-options">
                        <option value="再提出要" />
                        <option value="提出済み" />
                        <option value="未提出" />
                        <option value="両方完了" />
                        <option value="原本のみ" />
                      </datalist>
                    </div>
                  </div>
                </section>

                <section>
                  <h3>契約・プラン・日付</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>契約プラン</label>
                      <input type="text" name="initial_plan" defaultValue={editingStore?.initial_plan || ''} />
                    </div>
                    <div className="form-group">
                      <label>プラン追加</label>
                      <input type="text" name="plan_addition" defaultValue={editingStore?.plan_addition || ''} />
                    </div>
                    <div className="form-group">
                      <label>申込日</label>
                      <input type="date" name="application_date" defaultValue={editingStore?.application_date || ''} />
                    </div>
                    <div className="form-group">
                      <label>初回費用</label>
                      <input type="text" name="initial_cost" defaultValue={editingStore?.initial_cost || ''} />
                    </div>
                    <div className="form-group">
                      <label>更新月 (YYYY-MM)</label>
                      <input type="text" name="yearly_renewal_legacy" defaultValue={editingStore?.yearly_renewal_legacy || ''} />
                    </div>
                    <div className="form-group">
                      <label>原本到着日</label>
                      <input type="date" name="original_arrival_date" defaultValue={editingStore?.original_arrival_date || ''} />
                    </div>
                    <div className="form-group">
                      <label>ログイン情報送信日</label>
                      <input type="date" name="login_info_sent_date" defaultValue={editingStore?.login_info_sent_date || ''} />
                    </div>
                  </div>
                </section>

                <section>
                  <h3>その他・備考</h3>
                  <div className="form-group full-width">
                    <label>備考</label>
                    <textarea name="remarks" defaultValue={editingStore?.remarks || ''}></textarea>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>紹介者</label>
                      <input type="text" name="introducer" defaultValue={editingStore?.introducer || ''} />
                    </div>
                    <div className="form-group">
                      <label>NPセラーID</label>
                      <input type="text" name="np_seller_id" defaultValue={editingStore?.np_seller_id || ''} />
                    </div>
                  </div>
                </section>
              </div>

              <div className="modal-actions">
                <button type="button" className="action-btn cancel-btn" onClick={closeModal} disabled={isLoading}>キャンセル</button>
                <button type="submit" className="glass-btn" disabled={isLoading}>
                  {isLoading ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
