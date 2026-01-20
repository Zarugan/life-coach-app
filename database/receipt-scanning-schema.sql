-- Add receipt scanning and spending analysis tables

-- Receipt processing queue
CREATE TABLE IF NOT EXISTS receipt_processing_queue (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    options JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    ocr_result JSONB,
    parsed_data JSONB,
    enhanced_data JSONB,
    stored_receipt_id VARCHAR(255) REFERENCES receipts(id) ON DELETE SET NULL,
    analysis JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt images storage
CREATE TABLE IF NOT EXISTS receipt_images (
    id VARCHAR(255) PRIMARY KEY,
    receipt_id VARCHAR(255) NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    thumbnail_data TEXT,
    metadata JSONB DEFAULT '{}',
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    storage_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt validation logs
CREATE TABLE IF NOT EXISTS receipt_validation_logs (
    id VARCHAR(255) PRIMARY KEY,
    receipt_id VARCHAR(255) NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    validation_type VARCHAR(100) NOT NULL, -- 'ocr_confidence', 'amount_validation', 'merchant_verification'
    result VARCHAR(50) NOT NULL, -- 'passed', 'failed', 'warning'
    score DECIMAL(5,2), -- 0.00 to 100.00
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spending patterns and predictions
CREATE TABLE IF NOT EXISTS spending_patterns (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    merchant VARCHAR(255),
    day_of_week INTEGER, -- 0-6 (Sunday to Saturday)
    hour_of_day INTEGER, -- 0-23
    average_amount DECIMAL(10,2) NOT NULL,
    transaction_count INTEGER DEFAULT 1,
    pattern_type VARCHAR(50) NOT NULL, -- 'temporal', 'merchant', 'category'
    confidence_score DECIMAL(5,2) DEFAULT 50.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt corrections (manual edits)
CREATE TABLE IF NOT EXISTS receipt_corrections (
    id VARCHAR(255) PRIMARY KEY,
    receipt_id VARCHAR(255) NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL, -- 'merchant', 'amount', 'category', 'item_name'
    original_value TEXT NOT NULL,
    corrected_value TEXT NOT NULL,
    reason VARCHAR(255),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User budgets
CREATE TABLE IF NOT EXISTS user_budgets (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    spent DECIMAL(10,2) DEFAULT 0.00,
    period_type VARCHAR(20) NOT NULL, -- 'monthly', 'weekly', 'yearly'
    month INTEGER NOT NULL, -- 1-12
    year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category, period_type, month, year)
);

-- Receipt tags and categories (auto-generated)
CREATE TABLE IF NOT EXISTS receipt_tags (
    id VARCHAR(255) PRIMARY KEY,
    receipt_id VARCHAR(255) NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    confidence DECIMAL(5,2) DEFAULT 50.00,
    tag_type VARCHAR(50) NOT NULL, -- 'ai_generated', 'user_defined', 'system_suggested'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt performance metrics
CREATE TABLE IF NOT EXISTS receipt_processing_metrics (
    id VARCHAR(255) PRIMARY KEY,
    date DATE NOT NULL,
    total_receipts INTEGER DEFAULT 0,
    successful_processing INTEGER DEFAULT 0,
    failed_processing INTEGER DEFAULT 0,
    average_processing_time INTEGER DEFAULT 0,
    ocr_confidence_avg DECIMAL(5,2) DEFAULT 0.00,
    ai_confidence_avg DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shopping list generation from receipts
CREATE TABLE IF NOT EXISTS shopping_suggestions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    based_on_receipts JSONB NOT NULL,
    suggested_items JSONB NOT NULL,
    estimated_savings DECIMAL(10,2) DEFAULT 0.00,
    recommendation_type VARCHAR(100) NOT NULL, -- 'bulk_buy', 'alternative_brand', 'seasonal_optimization'
    confidence_score DECIMAL(5,2) DEFAULT 50.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for receipt scanning system
CREATE INDEX IF NOT EXISTS idx_receipt_processing_queue_user_id ON receipt_processing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_queue_status ON receipt_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_queue_created_at ON receipt_processing_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_receipt_images_receipt_id ON receipt_images(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_validation_logs_user_id ON receipt_validation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_validation_logs_type ON receipt_validation_logs(validation_type);
CREATE INDEX IF NOT EXISTS idx_spending_patterns_user_category ON spending_patterns(user_id, category);
CREATE INDEX IF NOT EXISTS idx_spending_patterns_temporal ON spending_patterns(day_of_week, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_user_budgets_user_category_period ON user_budgets(user_id, category, period_type, month, year);
CREATE INDEX IF NOT EXISTS idx_receipt_tags_receipt_id ON receipt_tags(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_processing_metrics_date ON receipt_processing_metrics(date);
CREATE INDEX IF NOT EXISTS idx_shopping_suggestions_user_id ON shopping_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_suggestions_expires ON shopping_suggestions(expires_at);

-- Triggers for budget updates and spending patterns
CREATE OR REPLACE FUNCTION update_spent_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Update spent amount in user_budgets when receipt is added
    UPDATE user_budgets 
    SET spent = spent + NEW.amount, updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND category = NEW.category 
      AND period_type = 'monthly'
      AND month = EXTRACT(MONTH FROM NEW.date)
      AND year = EXTRACT(YEAR FROM NEW.date);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_spending_pattern()
RETURNS TRIGGER AS $$
BEGIN
    -- Log spending patterns for analysis
    INSERT INTO spending_patterns (id, user_id, category, merchant, day_of_week, hour_of_day, average_amount, transaction_count, pattern_type, confidence_score, created_at)
    VALUES (
        gen_random_uuid()::text,
        NEW.user_id,
        NEW.category,
        NEW.merchant,
        EXTRACT(DOW FROM NEW.date),
        EXTRACT(HOUR FROM NEW.date),
        NEW.amount,
        1,
        'transaction',
        80.0, -- Base confidence for actual transactions
        NOW()
    )
    ON CONFLICT DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers (commented out as they need specific conditions)
-- CREATE TRIGGER trigger_update_spent_amount 
--     AFTER INSERT ON receipts 
--     FOR EACH ROW EXECUTE FUNCTION update_spent_amount();

-- CREATE TRIGGER trigger_log_spending_pattern 
--     AFTER INSERT ON receipts 
--     FOR EACH ROW EXECUTE FUNCTION log_spending_pattern();

-- Update triggers for timestamp fields
CREATE OR REPLACE FUNCTION update_receipt_processing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_spending_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_receipt_processing_queue_updated_at 
    BEFORE UPDATE ON receipt_processing_queue 
    FOR EACH ROW EXECUTE FUNCTION update_receipt_processing_queue_updated_at();

CREATE TRIGGER update_user_budgets_updated_at 
    BEFORE UPDATE ON user_budgets 
    FOR EACH ROW EXECUTE FUNCTION update_user_budgets_updated_at();

CREATE TRIGGER update_spending_patterns_updated_at 
    BEFORE UPDATE ON spending_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_spending_patterns_updated_at();