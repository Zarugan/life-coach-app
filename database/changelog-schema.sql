-- Add changelog and progress tracking tables

-- Agent activity log
CREATE TABLE IF NOT EXISTS agent_activity_log (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    activity VARCHAR(100) NOT NULL,
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress tracking enhancements
CREATE TABLE IF NOT EXISTS progress_tracking (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id VARCHAR(255) NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    current_value DECIMAL(10,2) NOT NULL,
    target_value DECIMAL(10,2),
    unit VARCHAR(50),
    notes TEXT,
    evidence JSONB DEFAULT '[]',
    automatic_entry BOOLEAN DEFAULT FALSE,
    source VARCHAR(100), -- 'manual', 'agent', 'sensor', 'api'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress summaries
CREATE TABLE IF NOT EXISTS progress_summaries (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary_data JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Milestone tracking
CREATE TABLE IF NOT EXISTS milestones (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id VARCHAR(255) NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_value DECIMAL(10,2),
    achieved_value DECIMAL(10,2),
    achieved_at TIMESTAMP WITH TIME ZONE,
    celebration_type VARCHAR(50), -- 'notification', 'badge', 'reward'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User streaks and habits
CREATE TABLE IF NOT EXISTS user_streaks (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL, -- 'workout', 'chore_completion', 'mindfulness'
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    streak_calendar JSONB DEFAULT '{}', -- Calendar tracking of streak
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress analytics cache
CREATE TABLE IF NOT EXISTS progress_analytics_cache (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    time_period VARCHAR(20) NOT NULL,
    analytic_data JSONB NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 day')
);

-- Motivational quotes and insights
CREATE TABLE IF NOT EXISTS motivational_content (
    id VARCHAR(255) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(255),
    tags JSONB DEFAULT '[]',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for enhanced changelog system
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_user_id ON agent_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_agent_id ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_timestamp ON agent_activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_user_id ON progress_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_goal_id ON progress_tracking(goal_id);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_timestamp ON progress_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_progress_summaries_user_period ON progress_summaries(user_id, period_type);
CREATE INDEX IF NOT EXISTS idx_progress_summaries_period ON progress_summaries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_achieved_at ON milestones(achieved_at);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_activity ON user_streaks(user_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_activity ON user_streaks(last_activity_date);
CREATE INDEX IF NOT EXISTS idx_progress_analytics_cache_user_metric ON progress_analytics_cache(user_id, metric_name, time_period);
CREATE INDEX IF NOT EXISTS idx_progress_analytics_cache_expires ON progress_analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_motivational_content_category ON motivational_content(category);
CREATE INDEX IF NOT EXISTS idx_motivational_content_tags ON motivational_content USING GIN(tags);

-- Triggers for streaks and summaries
CREATE OR REPLACE FUNCTION update_streak_on_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert streak record
    INSERT INTO user_streaks (user_id, activity_type, current_streak, last_activity_date, updated_at)
    VALUES (NEW.user_id, NEW.activity_type, 1, CURRENT_DATE, NOW())
    ON CONFLICT (user_id, activity_type) 
    DO UPDATE SET 
        current_streak = CASE 
            WHEN user_streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' 
            THEN user_streaks.current_streak + 1
            ELSE 1
        END,
        last_activity_date = CURRENT_DATE,
        updated_at = NOW(),
        longest_streak = GREATEST(user_streaks.longest_streak, 
            CASE 
                WHEN user_streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' 
                THEN user_streaks.current_streak + 1
                ELSE 1
            END
        );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for progress updates
CREATE OR REPLACE FUNCTION auto_generate_milestones()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if progress reaches milestone (75%, 90%, 100%)
    IF NEW.target_value > 0 THEN
        DECLARE progress_percentage DECIMAL;
        BEGIN
            progress_percentage := (NEW.current_value / NEW.target_value) * 100;
            
            -- Create milestone for 75% completion
            IF progress_percentage >= 75 AND progress_percentage < 90 THEN
                INSERT INTO milestones (id, user_id, goal_id, title, description, target_value, achieved_value, achieved_at, created_at)
                VALUES (
                    gen_random_uuid()::text, 
                    NEW.user_id, 
                    NEW.goal_id, 
                    '75% Milestone Reached', 
                    'You''re 75% of the way to your goal!', 
                    NEW.target_value, 
                    NEW.current_value, 
                    NOW(), 
                    NOW()
                );
            END IF;
            
            -- Create milestone for 90% completion
            IF progress_percentage >= 90 AND progress_percentage < 100 THEN
                INSERT INTO milestones (id, user_id, goal_id, title, description, target_value, achieved_value, achieved_at, created_at)
                VALUES (
                    gen_random_uuid()::text, 
                    NEW.user_id, 
                    NEW.goal_id, 
                    '90% Milestone Reached', 
                    'Almost there! 90% of goal completed!', 
                    NEW.target_value, 
                    NEW.current_value, 
                    NOW(), 
                    NOW()
                );
            END IF;
            
            -- Create milestone for 100% completion
            IF progress_percentage >= 100 THEN
                INSERT INTO milestones (id, user_id, goal_id, title, description, target_value, achieved_value, achieved_at, created_at)
                VALUES (
                    gen_random_uuid()::text, 
                    NEW.user_id, 
                    NEW.goal_id, 
                    'Goal Completed! 🎉', 
                    'Congratulations! You''ve achieved your goal!', 
                    NEW.target_value, 
                    NEW.current_value, 
                    NOW(), 
                    NOW()
                );
            END IF;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
-- Note: These triggers would need to be created with specific conditions
-- CREATE TRIGGER trigger_name AFTER INSERT ON progress_tracking 
--     FOR EACH ROW EXECUTE FUNCTION function_name();