import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import axios from 'axios';

export class LocationServices {
  private openai: any;
  private googleMapsApiKey: string;
  private safetyDataSources: Map<string, any> = new Map();

  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    this.initializeSafetyDataSources();
  }

  async initialize(): Promise<void> {
    try {
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      logger.info('Location Services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Location Services:', error);
      throw error;
    }
  }

  async findNearbyPlaces(
    userId: string,
    latitude: number,
    longitude: number,
    radius: number = 1000,
    categories: string[] = []
  ): Promise<any> {
    try {
      // Get user preferences for filtering
      const userPreferences = await this.getUserLocationPreferences(userId);
      
      // Search for places using multiple APIs
      const places = await this.searchNearbyPlaces(
        latitude,
        longitude,
        radius,
        categories,
        userPreferences
      );
      
      // Rate and filter places based on user needs
      const ratedPlaces = await this.ratePlacesForUser(userId, places);
      
      // Add cross-agent insights
      const enhancedPlaces = await this.addAgentInsightsToPlaces(userId, ratedPlaces);
      
      return {
        places: enhancedPlaces,
        totalCount: places.length,
        searchArea: {
          center: { latitude, longitude },
          radius
        },
        categories: this.getCategorySummary(enhancedPlaces)
      };

    } catch (error) {
      logger.error('Error finding nearby places:', error);
      throw error;
    }
  }

  async analyzeAreaSafety(
    userId: string,
    latitude: number,
    longitude: number,
    radius: number = 500
  ): Promise<any> {
    try {
      // Get comprehensive safety data
      const safetyData = await this.collectSafetyData(latitude, longitude, radius);
      
      // Analyze crime statistics
      const crimeAnalysis = await this.analyzeCrimeData(safetyData.crime);
      
      // Assess environmental factors
      const environmentalAnalysis = await this.analyzeEnvironmentalFactors(safetyData.environmental);
      
      // Evaluate infrastructure safety
      const infrastructureAnalysis = await this.analyzeInfrastructure(safetyData.infrastructure);
      
      // Generate overall safety assessment
      const safetyAssessment = await this.generateSafetyAssessment({
        crime: crimeAnalysis,
        environmental: environmentalAnalysis,
        infrastructure: infrastructureAnalysis
      });
      
      // Get user-specific safety concerns
      const userConcerns = await this.getUserSafetyConcerns(userId);
      
      // Generate personalized recommendations
      const recommendations = await this.generateSafetyRecommendations(
        safetyAssessment,
        userConcerns
      );
      
      return {
        overallRisk: safetyAssessment.riskLevel,
        riskScore: safetyAssessment.score,
        factors: {
          crime: crimeAnalysis,
          environmental: environmentalAnalysis,
          infrastructure: infrastructureAnalysis
        },
        recommendations,
        safeAreas: safetyAssessment.safeAreas,
        cautionAreas: safetyAssessment.cautionAreas,
        userConcerns
      };

    } catch (error) {
      logger.error('Error analyzing area safety:', error);
      throw error;
    }
  }

  async planSafeRoute(
    userId: string,
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    preferences: any = {}
  ): Promise<any> {
    try {
      // Get user safety preferences
      const userPreferences = await this.getUserLocationPreferences(userId);
      
      // Get multiple route options
      const routeOptions = await this.getRouteOptions(start, end);
      
      // Analyze each route for safety
      const safetyAnalysis = await Promise.all(
        routeOptions.map(route => 
          this.analyzeRouteSafety(route, userPreferences)
        )
      );
      
      // Score and rank routes
      const rankedRoutes = await this.rankRoutesBySafety(
        routeOptions,
        safetyAnalysis,
        preferences
      );
      
      // Get alternative safe routes
      const alternativeRoutes = rankedRoutes.slice(1, 4);
      
      // Generate route-specific guidance
      const routeGuidance = await this.generateRouteGuidance(
        rankedRoutes[0],
        safetyAnalysis[0]
      );
      
      return {
        recommendedRoute: rankedRoutes[0],
        overallSafetyScore: rankedRoutes[0].safetyScore,
        alternativeRoutes,
        routeGuidance,
        safetyAnalysis: safetyAnalysis[0],
        estimatedTime: rankedRoutes[0].duration,
        distance: rankedRoutes[0].distance
      };

    } catch (error) {
      logger.error('Error planning safe route:', error);
      throw error;
    }
  }

  async getLocationBasedRecommendations(
    userId: string,
    latitude: number,
    longitude: number,
    context: string = 'general'
  ): Promise<any> {
    try {
      // Get user profile and current context
      const userProfile = await this.getUserProfile(userId);
      const currentContext = await this.analyzeCurrentContext(userId, context);
      
      // Get nearby opportunities
      const nearbyOpportunities = await this.findNearbyOpportunities(
        latitude,
        longitude,
        userProfile,
        currentContext
      );
      
      // Generate contextual recommendations
      const recommendations = await this.generateContextualRecommendations(
        userId,
        nearbyOpportunities,
        currentContext
      );
      
      // Add agent-specific recommendations
      const agentRecommendations = await this.getAgentLocationRecommendations(
        userId,
        latitude,
        longitude,
        context
      );
      
      return {
        recommendations,
        agentRecommendations,
        context: currentContext,
        location: { latitude, longitude },
        opportunityTypes: this.getOpportunityTypes(nearbyOpportunities)
      };

    } catch (error) {
      logger.error('Error getting location-based recommendations:', error);
      throw error;
    }
  }

  async checkLocationAlerts(
    userId: string,
    latitude: number,
    longitude: number,
    alertTypes: string[] = []
  ): Promise<any> {
    try {
      const alerts = [];
      
      // Check safety alerts
      if (alertTypes.includes('safety') || alertTypes.length === 0) {
        const safetyAlerts = await this.checkSafetyAlerts(userId, latitude, longitude);
        alerts.push(...safetyAlerts);
      }
      
      // Check opportunity alerts
      if (alertTypes.includes('opportunities') || alertTypes.length === 0) {
        const opportunityAlerts = await this.checkOpportunityAlerts(userId, latitude, longitude);
        alerts.push(...opportunityAlerts);
      }
      
      // Check agent-relevant alerts
      if (alertTypes.includes('agents') || alertTypes.length === 0) {
        const agentAlerts = await this.checkAgentLocationAlerts(userId, latitude, longitude);
        alerts.push(...agentAlerts);
      }
      
      return alerts;
    } catch (error) {
      logger.error('Error checking location alerts:', error);
      throw error;
    }
  }

  private async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number,
    categories: string[],
    userPreferences: any
  ): Promise<any[]> {
    try {
      // Use Google Places API
      let places = [];
      
      if (this.googleMapsApiKey) {
        places = await this.searchGooglePlaces(
          latitude,
          longitude,
          radius,
          categories
        );
      } else {
        // Fallback to OpenStreetMap
        places = await this.searchOpenStreetMap(
          latitude,
          longitude,
          radius,
          categories
        );
      }
      
      return places;
    } catch (error) {
      logger.error('Error searching nearby places:', error);
      return [];
    }
  }

  private async searchGooglePlaces(
    latitude: number,
    longitude: number,
    radius: number,
    categories: string[]
  ): Promise<any[]> {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
      const params = {
        location: `${latitude},${longitude}`,
        radius: radius,
        key: this.googleMapsApiKey
      };

      if (categories.length > 0) {
        params.type = categories[0];
      }

      const response = await axios.get(url, { params });
      return response.data.results || [];
    } catch (error) {
      logger.error('Error searching Google Places:', error);
      return [];
    }
  }

  private async searchOpenStreetMap(
    latitude: number,
    longitude: number,
    radius: number,
    categories: string[]
  ): Promise<any[]> {
    try {
      const bbox = [
        longitude - radius / 111320,
        latitude - radius / 111320,
        longitude + radius / 111320,
        latitude + radius / 111320
      ].join(',');

      let query = `
        [out:json][timeout:25];
        (
          node["amenity"](${bbox});
          way["amenity"](${bbox});
          relation["amenity"](${bbox});
        );
        out geom;
      `;

      if (categories.length > 0) {
        query = query.replace('["amenity"]', `["${categories[0]}"]`);
      }

      const response = await axios.get(`https://overpass-api.de/api/interpreter`, {
        params: { data: query }
      });

      return this.formatOpenStreetMapResults(response.data.elements);
    } catch (error) {
      logger.error('Error searching OpenStreetMap:', error);
      return [];
    }
  }

  private formatOpenStreetMapResults(elements: any[]): any[] {
    return elements.map(element => ({
      id: element.id,
      name: element.tags?.name || 'Unknown',
      type: element.tags?.amenity || 'place',
      latitude: element.lat || element.center?.lat,
      longitude: element.lon || element.center?.lon,
      tags: element.tags || {},
      vicinity: element.tags?.['addr:street'] || ''
    }));
  }

  private async ratePlacesForUser(userId: string, places: any[]): Promise<any[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      
      return places.map(place => ({
        ...place,
        userRating: this.calculateUserRating(place, userProfile),
        relevanceScore: this.calculateRelevanceScore(place, userProfile),
        agentInsights: {} // Will be populated by addAgentInsightsToPlaces
      }));
    } catch (error) {
      logger.error('Error rating places for user:', error);
      return places;
    }
  }

  private calculateUserRating(place: any, userProfile: any): number {
    // Calculate rating based on user preferences
    let rating = 3.0; // Base rating
    
    // Adjust based on user preferences
    if (userPreferences.preferredCategories?.includes(place.type)) {
      rating += 1.0;
    }
    
    if (userPreferences.avoidedCategories?.includes(place.type)) {
      rating -= 1.0;
    }
    
    return Math.max(1, Math.min(5, rating));
  }

  private calculateRelevanceScore(place: any, userProfile: any): number {
    // Calculate relevance based on current context and goals
    return Math.random() * 2 + 3; // Placeholder
  }

  private async addAgentInsightsToPlaces(userId: string, places: any[]): Promise<any[]> {
    try {
      // Add insights from different agents based on place types
      return places.map(place => ({
        ...place,
        agentInsights: this.getAgentInsightsForPlace(place)
      }));
    } catch (error) {
      logger.error('Error adding agent insights to places:', error);
      return places;
    }
  }

  private getAgentInsightsForPlace(place: any): any {
    const insights = {};
    
    // Financial advisor insights for shopping places
    if (place.type === 'shop' || place.type === 'supermarket') {
      insights.financialAdvisor = {
        type: 'cost-opportunity',
        message: 'Check for deals and compare prices',
        budgetImpact: 'medium'
      };
    }
    
    // Dietitian insights for food places
    if (place.type === 'restaurant' || place.type === 'fast_food') {
      insights.dietitian = {
        type: 'nutrition-info',
        message: 'Look for healthy options on the menu',
        healthImpact: 'medium'
      };
    }
    
    // Fitness trainer insights for gyms and parks
    if (place.type === 'gym' || place.type === 'park') {
      insights.fitnessTrainer = {
        type: 'exercise-opportunity',
        message: 'Great place for physical activity',
        fitnessBenefit: 'high'
      };
    }
    
    return insights;
  }

  private async collectSafetyData(latitude: number, longitude: number, radius: number): Promise<any> {
    return {
      crime: await this.getCrimeData(latitude, longitude, radius),
      environmental: await this.getEnvironmentalData(latitude, longitude, radius),
      infrastructure: await this.getInfrastructureData(latitude, longitude, radius)
    };
  }

  private async getCrimeData(latitude: number, longitude: number, radius: number): Promise<any> {
    // In production, would integrate with crime APIs like:
    // - CrimeReports.com
    // - Police department APIs
    // - City crime data
    
    return {
      overallCrimeRate: 'low',
      recentIncidents: [],
      crimeTypes: {
        violent: 'very low',
        property: 'low',
        quality_of_life: 'low'
      }
    };
  }

  private async getEnvironmentalData(latitude: number, longitude: number, radius: number): Promise<any> {
    return {
      airQuality: 'good',
      noiseLevel: 'moderate',
      lighting: 'good',
      walkability: 'high',
      bikeFriendliness: 'moderate'
    };
  }

  private async getInfrastructureData(latitude: number, longitude: number, radius: number): Promise<any> {
    return {
      roadQuality: 'good',
      sidewalkCondition: 'good',
      streetLighting: 'adequate',
      publicTransport: 'available',
      emergencyServices: 'accessible'
    };
  }

  private async analyzeCrimeData(crimeData: any): Promise<any> {
    return {
      riskLevel: this.calculateCrimeRisk(crimeData),
      trends: 'stable',
      hotspots: [],
      recommendations: ['Standard precautions recommended']
    };
  }

  private async analyzeEnvironmentalFactors(environmentalData: any): Promise<any> {
    return {
      overallScore: 'good',
      concerns: [],
      benefits: ['Good air quality', 'Well-lit areas'],
      recommendations: []
    };
  }

  private async analyzeInfrastructure(infrastructureData: any): Promise<any> {
    return {
      overallCondition: 'good',
      accessibility: 'high',
      maintenance: 'adequate',
      recommendations: []
    };
  }

  private calculateCrimeRisk(crimeData: any): 'very low' | 'low' | 'medium' | 'high' | 'very high' {
    // Calculate overall crime risk
    return 'low';
  }

  private async generateSafetyAssessment(safetyData: any): Promise<any> {
    try {
      const prompt = `
        Generate a comprehensive safety assessment based on:
        - Crime Data: ${JSON.stringify(safetyData.crime)}
        - Environmental Data: ${JSON.stringify(safetyData.environmental)}
        - Infrastructure Data: ${JSON.stringify(safetyData.infrastructure)}
        
        Provide assessment with:
        - riskLevel: very low/low/medium/high/very high
        - score: 0-100 safety score
        - safeAreas: Areas that are particularly safe
        - cautionAreas: Areas requiring extra caution
        - overallAssessment: Summary of safety conditions
        
        Return JSON with detailed safety assessment.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a safety assessment expert. Provide accurate, balanced safety evaluations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        maxTokens: 1000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating safety assessment:', error);
      return {
        riskLevel: 'low',
        score: 75,
        safeAreas: [],
        cautionAreas: [],
        overallAssessment: 'Area appears to be reasonably safe'
      };
    }
  }

  private async getUserSafetyConcerns(userId: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT safety_concerns FROM user_preferences WHERE user_id = $1',
        [userId]
      );
      
      return result.rows[0]?.safety_concerns || {
        walkingAlone: false,
        nightTime: false,
        parking: false,
        publicTransport: false
      };
    } catch (error) {
      logger.error('Error getting user safety concerns:', error);
      return {};
    }
  }

  private async generateSafetyRecommendations(
    safetyAssessment: any,
    userConcerns: any
  ): Promise<any[]> {
    const recommendations = [];
    
    if (safetyAssessment.riskLevel !== 'very low') {
      recommendations.push({
        type: 'general',
        priority: 'medium',
        title: 'Stay Aware of Surroundings',
        description: 'Keep your phone away and remain alert to your environment'
      });
    }
    
    if (userConcerns.walkingAlone) {
      recommendations.push({
        type: 'personal',
        priority: 'high',
        title: 'Consider Walking Companion',
        description: 'Use buddy system or share your location with someone'
      });
    }
    
    return recommendations;
  }

  private async getUserLocationPreferences(userId: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT location_preferences FROM user_preferences WHERE user_id = $1',
        [userId]
      );
      
      return result.rows[0]?.location_preferences || {
        preferredCategories: ['restaurant', 'park', 'shop'],
        avoidedCategories: ['bar', 'nightclub'],
        maxDistance: 2000,
        transportMode: 'walking'
      };
    } catch (error) {
      logger.error('Error getting user location preferences:', error);
      return {};
    }
  }

  private getCategorySummary(places: any[]): any {
    const categories = {};
    
    places.forEach(place => {
      categories[place.type] = (categories[place.type] || 0) + 1;
    });
    
    return categories;
  }

  private async getRouteOptions(start: any, end: any): Promise<any[]> {
    // In production, would use routing APIs like Google Directions
    return [
      {
        id: 'route_1',
        points: [start, end],
        distance: 1000,
        duration: 12,
        geometry: 'straight_line_path'
      }
    ];
  }

  private async analyzeRouteSafety(route: any, userPreferences: any): Promise<any> {
    return {
      safetyScore: 85,
      riskFactors: [],
      safeSegments: ['main_road'],
      cautionSegments: [],
      recommendations: []
    };
  }

  private async rankRoutesBySafety(
    routes: any[],
    safetyAnalysis: any[],
    preferences: any
  ): Promise<any[]> {
    return routes.map((route, index) => ({
      ...route,
      safetyScore: safetyAnalysis[index].safetyScore,
      safetyAnalysis: safetyAnalysis[index]
    })).sort((a, b) => b.safetyScore - a.safetyScore);
  }

  private async generateRouteGuidance(route: any, safetyAnalysis: any): Promise<any> {
    return {
      preTravel: ['Check weather conditions', 'Share route with someone'],
      duringTravel: ['Stay on main roads', 'Keep phone charged'],
      emergency: ['Know emergency contacts', 'Identify safe places along route']
    };
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );
      
      return result.rows[0]?.preferences || {};
    } catch (error) {
      logger.error('Error getting user profile:', error);
      return {};
    }
  }

  private async analyzeCurrentContext(userId: string, context: string): Promise<any> {
    return {
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      weather: 'clear',
      userActivity: context,
      goals: await this.getUserGoals(userId)
    };
  }

  private async getUserGoals(userId: string): Promise<any[]> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT * FROM goals WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting user goals:', error);
      return [];
    }
  }

  private async findNearbyOpportunities(
    latitude: number,
    longitude: number,
    userProfile: any,
    context: any
  ): Promise<any[]> {
    return [
      {
        type: 'fitness',
        title: 'Nearby Gym',
        description: 'Well-equipped gym 5 minutes away',
        distance: 400,
        relevance: 0.8
      }
    ];
  }

  private async generateContextualRecommendations(
    userId: string,
    opportunities: any[],
    context: any
  ): Promise<any[]> {
    return opportunities.map(opp => ({
      ...opp,
      recommendation: `Consider visiting ${opp.title} for your ${opp.type} goals`,
      timing: this.recommendTiming(opp, context),
      agent: this.getRelevantAgent(opp.type)
    }));
  }

  private recommendTiming(opportunity: any, context: any): string {
    if (context.timeOfDay < 12) return 'Morning visit recommended';
    if (context.timeOfDay < 17) return 'Afternoon visit recommended';
    return 'Evening visit recommended';
  }

  private getRelevantAgent(type: string): string {
    const agentMapping = {
      'fitness': 'fitness-trainer',
      'food': 'dietitian',
      'shopping': 'financial-advisor',
      'health': 'digital-wellness'
    };
    
    return agentMapping[type] || 'lead-coordinator';
  }

  private async getAgentLocationRecommendations(
    userId: string,
    latitude: number,
    longitude: number,
    context: string
  ): Promise<any[]> {
    return [
      {
        agent: 'fitness-trainer',
        recommendation: 'Nearby park perfect for morning run',
        location: { name: 'Central Park', distance: 300 }
      }
    ];
  }

  private getOpportunityTypes(opportunities: any[]): string[] {
    return [...new Set(opportunities.map(opp => opp.type))];
  }

  private async checkSafetyAlerts(userId: string, latitude: number, longitude: number): Promise<any[]> {
    return [
      {
        type: 'safety',
        level: 'info',
        title: 'Area Safety Notice',
        message: 'This area is generally safe during daytime',
        location: { latitude, longitude }
      }
    ];
  }

  private async checkOpportunityAlerts(userId: string, latitude: number, longitude: number): Promise<any[]> {
    return [
      {
        type: 'opportunity',
        level: 'info',
        title: 'Nearby Opportunity',
        message: 'Gym with current promotion is nearby',
        location: { latitude, longitude }
      }
    ];
  }

  private async checkAgentLocationAlerts(userId: string, latitude: number, longitude: number): Promise<any[]> {
    return [
      {
        type: 'agent',
        level: 'info',
        title: 'Agent Recommendation',
        message: 'Great location for your fitness goals',
        agent: 'fitness-trainer',
        location: { latitude, longitude }
      }
    ];
  }

  private initializeSafetyDataSources(): void {
    // Initialize various safety data sources
    this.safetyDataSources.set('crime', {
      name: 'Crime Data',
      url: '',
      updateFrequency: 'daily'
    });
    
    this.safetyDataSources.set('weather', {
      name: 'Weather Data',
      url: '',
      updateFrequency: 'hourly'
    });
  }
}