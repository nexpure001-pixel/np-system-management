-- 1. STORES Table (店舗管理)
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    no TEXT,
    store_id TEXT UNIQUE,
    store_name TEXT,
    corporate_name TEXT,
    representative TEXT,
    contact_person TEXT,
    email TEXT,
    password TEXT,
    np_seller_id TEXT,
    introducer TEXT,
    initial_plan TEXT,
    plan_addition TEXT,
    application_form TEXT,
    application_date DATE,
    initial_cost TEXT,
    payment_status TEXT,
    payment_date TIMESTAMP WITH TIME ZONE,
    doc_consent TEXT,
    doc_registry TEXT,
    doc_resident TEXT,
    email_arrival_date DATE,
    original_arrival_date DATE,
    login_info_sent_date DATE,
    renewal_month TEXT,
    remarks TEXT,
    product_setting_plan TEXT,
    not_purchased_list TEXT,
    changed_during_activity TEXT,
    shipping_date_entered TEXT,
    distinction TEXT,
    sales_ok TEXT,
    yearly_renewal_legacy TEXT,
    yearly_renewal_month TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USERS Table (有給管理 - 社員プロファイル)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'employee')) DEFAULT 'employee',
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. LEAVE GRANTS (有給付与データ)
CREATE TABLE IF NOT EXISTS public.leave_grants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  days_granted NUMERIC(5, 3) NOT NULL CHECK (days_granted > 0),
  days_used NUMERIC(5, 3) NOT NULL DEFAULT 0 CHECK (days_used >= 0),
  valid_from DATE NOT NULL,
  expiry_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_days_limit CHECK (days_used <= days_granted)
);

-- 4. LEAVE REQUESTS (有給申請)
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date_requested DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  amount_days NUMERIC(5, 3) NOT NULL DEFAULT 1.0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. LEAVE CONSUMPTIONS (消化履歴)
CREATE TABLE IF NOT EXISTS public.leave_consumptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID REFERENCES public.leave_requests(id) ON DELETE CASCADE NOT NULL,
  grant_id UUID REFERENCES public.leave_grants(id) ON DELETE CASCADE NOT NULL,
  days_consumed NUMERIC(5, 3) NOT NULL CHECK (days_consumed > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. PAYMENTS Table (入金管理)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shiharaibi_nyuuryoku BOOLEAN DEFAULT FALSE,
    box_idou BOOLEAN DEFAULT FALSE,
    touroku_jouhou TEXT,
    soshikizu_kakunin BOOLEAN DEFAULT FALSE,
    rank_up_bikou TEXT,
    chuumonbi DATE,
    shimei TEXT,
    nyuukin_kingaku NUMERIC,
    bikou TEXT,
    kanryou BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- FUNCTIONS ---

-- 有給残数計算
CREATE OR REPLACE FUNCTION calculate_remaining_leave(target_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_remaining NUMERIC;
BEGIN
  SELECT COALESCE(SUM(days_granted - days_used), 0)
  INTO total_remaining
  FROM public.leave_grants
  WHERE user_id = target_user_id
    AND expiry_date >= CURRENT_DATE;
  
  RETURN total_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 有給承認 (FIFO消化ロジック)
CREATE OR REPLACE FUNCTION approve_leave_request(target_request_id UUID)
RETURNS VOID AS $$
DECLARE
  req_record RECORD;
  grant_record RECORD;
  days_needed NUMERIC;
  days_available NUMERIC;
  days_to_take NUMERIC;
BEGIN
  SELECT * INTO req_record FROM public.leave_requests WHERE id = target_request_id FOR UPDATE;
  
  IF req_record.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  days_needed := req_record.amount_days;

  IF calculate_remaining_leave(req_record.user_id) < days_needed THEN
     RAISE EXCEPTION 'Insufficient leave balance';
  END IF;

  FOR grant_record IN 
    SELECT * FROM public.leave_grants 
    WHERE user_id = req_record.user_id 
      AND expiry_date >= CURRENT_DATE
      AND (days_granted - days_used) > 0
    ORDER BY expiry_date ASC
    FOR UPDATE
  LOOP
    EXIT WHEN days_needed <= 0;

    days_available := grant_record.days_granted - grant_record.days_used;
    
    IF days_available >= days_needed THEN
      days_to_take := days_needed;
    ELSE
      days_to_take := days_available;
    END IF;

    UPDATE public.leave_grants 
    SET days_used = days_used + days_to_take
    WHERE id = grant_record.id;

    INSERT INTO public.leave_consumptions (request_id, grant_id, days_consumed)
    VALUES (target_request_id, grant_record.id, days_to_take);

    days_needed := days_needed - days_to_take;
  END LOOP;

  UPDATE public.leave_requests
  SET status = 'approved'
  WHERE id = target_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLSの有効化 (必要に応じて)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 簡易ポリシー (デモ・個人利用向けに全て許可。本番運用では適切に制限してください)
DROP POLICY IF EXISTS "Allow all stores" ON public.stores;
DROP POLICY IF EXISTS "Allow all users" ON public.users;
DROP POLICY IF EXISTS "Allow all grants" ON public.leave_grants;
DROP POLICY IF EXISTS "Allow all requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow all consumptions" ON public.leave_consumptions;
DROP POLICY IF EXISTS "Allow all payments" ON public.payments;

CREATE POLICY "Allow all stores" ON public.stores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all grants" ON public.leave_grants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all requests" ON public.leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all consumptions" ON public.leave_consumptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
