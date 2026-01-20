-- Add location services tables

-- User location preferences
CREATE TABLE IF NOT EXISTS user_location_preferences (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferred_categories JSONB DEFAULT '[]',
    avoided_categories JSONB DEFAULT '[]',
    max_distance INTEGER DEFAULT 2000,
    transport_mode VARCHAR(50) DEFAULT 'walking',
    safety_concerns JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Location search history
CREATE TABLE IF NOT EXISTS location_searches (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius INTEGER DEFAULT 1000,
    categories JSONB DEFAULT '[]',
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Area safety assessments
CREATE TABLE IF NOT EXISTS area_safety_assessments (
    id VARCHAR(255) PRIMARY KEY,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius INTEGER DEFAULT 500,
    overall_risk VARCHAR(20) NOT NULL,
    risk_score INTEGER NOT NULL,
    crime_data JSONB DEFAULT '{}',
    environmental_data JSONB DEFAULT '{}',
    infrastructure_data JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Safe routes cache
CREATE TABLE IF NOT EXISTS safe_routes (
    id VARCHAR(255) PRIMARY KEY,
    start_latitude DECIMAL(10, 8) NOT NULL,
    start_longitude DECIMAL(11, 8) NOT NULL,
    end_latitude DECIMAL(10, 8) NOT NULL,
    end_longitude DECIMAL(11, 8) NOT NULL,
    route_data JSONB NOT NULL,
    safety_score INTEGER NOT NULL,
    safety_analysis JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 day')
);

-- Location alerts
CREATE TABLE IF NOT EXISTS location_alerts (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nearby places cache
CREATE TABLE IF NOT EXISTS nearby_places_cache (
    id VARCHAR(255) PRIMARY KEY,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius INTEGER NOT NULL,
    categories JSONB DEFAULT '[]',
    places_data JSONB NOT NULL,
    total_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Agent location insights
CREATE TABLE IF NOT EXISTS agent_location_insights (
    id VARCHAR(255) PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    place_id VARCHAR(255),
    place_name VARCHAR(255),
    insight_type VARCHAR(50) NOT NULL,
    insight_data JSONB NOT NULL,
    relevance_score DECIMAL(3, 2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Location-based recommendations
CREATE TABLE IF NOT EXISTS location_recommendations (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    context VARCHAR(50) NOT NULL,
    recommendation_data JSONB NOT NULL,
    opportunity_types JSONB DEFAULT '[]',
    agent_recommendations JSONB DEFAULT '[]',
    viewed BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    acted_upon BOOLEAN DEFAULT FALSE,
    acted_upon_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for location services
CREATE INDEX IF NOT EXISTS idx_user_location_preferences_user_id ON user_location_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_location_searches_user_id ON location_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_location_searches_location ON location_searches(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_area_safety_assessments_location ON area_safety_assessments(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_safe_routes_start_location ON safe_routes(start_latitude, start_longitude);
CREATE INDEX IF NOT EXISTS idx_safe_routes_end_location ON safe_routes(end_latitude, end_longitude);
CREATE INDEX IF NOT EXISTS idx_location_alerts_user_id ON location_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_location_alerts_location ON location_alerts(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_nearby_places_cache_location ON nearby_places_cache(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_agent_location_insights_agent_id ON agent_location_insights(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_location_insights_location ON agent_location_insights(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_location_recommendations_user_id ON location_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_location_recommendations_location ON location_recommendations(latitude, longitude);

-- Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_location_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_location_preferences_updated_at 
    BEFORE UPDATE ON user_location_preferences
    FOR EACH ROW EXECUTE FUNCTION update_location_preferences_updated_at();