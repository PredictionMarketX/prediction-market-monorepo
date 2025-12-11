'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AIConfig {
  ai_version: string;
  llm_model: string;
  validation_confidence_threshold: number;
  categories: string[];
  rate_limits: {
    propose_per_minute: number;
    propose_per_hour: number;
    propose_per_day: number;
    dispute_per_hour: number;
    dispute_per_day: number;
    auto_publish_per_hour: number;
  };
  dispute_window_hours: number;
  max_retries: number;
  processing_delay_ms: number;
}

// Helper to format milliseconds as human-readable
function formatDelay(ms: number): string {
  if (ms >= 60000) {
    const minutes = ms / 60000;
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${ms / 1000} second${ms !== 1000 ? 's' : ''}`;
}

interface ConfigMetadata {
  [key: string]: {
    updated_at: string;
    updated_by: string;
  };
}

const LLM_MODELS = [
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

const ALL_CATEGORIES = [
  'politics',
  'product_launch',
  'finance',
  'sports',
  'entertainment',
  'technology',
  'misc',
];

async function getAIConfig(walletAddress?: string): Promise<{ config: AIConfig; metadata: ConfigMetadata }> {
  const headers: Record<string, string> = {};
  if (walletAddress) {
    headers['x-user-address'] = walletAddress;
  }
  const response = await fetch(`${API_BASE}/api/v1/admin/ai-config`, { headers });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch config');
  }
  const result = await response.json();
  return result.data;
}

async function updateAIConfig(updates: Partial<AIConfig>, walletAddress?: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (walletAddress) {
    headers['x-user-address'] = walletAddress;
  }
  const response = await fetch(`${API_BASE}/api/v1/admin/ai-config`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update config');
  }
}

export default function AdminAIConfigPage() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58();

  const [config, setConfig] = useState<AIConfig | null>(null);
  const [metadata, setMetadata] = useState<ConfigMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<AIConfig>>({});

  useEffect(() => {
    async function load() {
      if (!walletAddress) {
        setIsLoading(false);
        return;
      }
      try {
        const { config, metadata } = await getAIConfig(walletAddress);
        setConfig(config);
        setMetadata(metadata);
        setFormData({
          llm_model: config.llm_model,
          validation_confidence_threshold: config.validation_confidence_threshold,
          dispute_window_hours: config.dispute_window_hours,
          rate_limits: config.rate_limits,
          categories: config.categories,
          processing_delay_ms: config.processing_delay_ms,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [walletAddress]);

  const handleSave = async () => {
    if (!walletAddress) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateAIConfig(formData, walletAddress);
      setSuccess('Configuration updated successfully');
      // Reload config
      const { config, metadata } = await getAIConfig(walletAddress);
      setConfig(config);
      setMetadata(metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    const current = formData.categories || config?.categories || [];
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    setFormData({ ...formData, categories: updated });
  };

  const handleRateLimitChange = (key: keyof AIConfig['rate_limits'], value: number) => {
    setFormData({
      ...formData,
      rate_limits: {
        ...(formData.rate_limits || config?.rate_limits || {}),
        [key]: value,
      } as AIConfig['rate_limits'],
    });
  };

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-400">Please connect your wallet to access AI configuration.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Loading configuration...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-red-400">{error || 'Failed to load configuration'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">AI Configuration</h1>
        <span className="text-sm text-gray-400">Version: {config.ai_version}</span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded text-green-400">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* LLM Model */}
        <section className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">LLM Model</h2>
          <select
            value={formData.llm_model || config.llm_model}
            onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
          >
            {LLM_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
          {metadata?.llm_model && (
            <p className="text-xs text-gray-500 mt-2">
              Last updated: {new Date(metadata.llm_model.updated_at).toLocaleString()} by{' '}
              {metadata.llm_model.updated_by}
            </p>
          )}
        </section>

        {/* Validation Threshold */}
        <section className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Validation Confidence Threshold</h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={formData.validation_confidence_threshold ?? config.validation_confidence_threshold}
              onChange={(e) =>
                setFormData({ ...formData, validation_confidence_threshold: parseFloat(e.target.value) })
              }
              className="flex-1"
            />
            <span className="text-white font-medium w-16 text-center">
              {Math.round((formData.validation_confidence_threshold ?? config.validation_confidence_threshold) * 100)}%
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Proposals below this confidence will be flagged for human review
          </p>
        </section>

        {/* Dispute Window */}
        <section className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Dispute Window</h2>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max="168"
              value={formData.dispute_window_hours ?? config.dispute_window_hours}
              onChange={(e) =>
                setFormData({ ...formData, dispute_window_hours: parseInt(e.target.value) })
              }
              className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            <span className="text-gray-400">hours</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Time window after resolution during which disputes can be submitted
          </p>
        </section>

        {/* Processing Delay */}
        <section className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Processing Delay</h2>
          <div className="flex items-center gap-4">
            <select
              value={formData.processing_delay_ms ?? config.processing_delay_ms ?? 60000}
              onChange={(e) =>
                setFormData({ ...formData, processing_delay_ms: parseInt(e.target.value) })
              }
              className="w-48 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value={0}>No delay</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
              <option value={120000}>2 minutes</option>
              <option value={300000}>5 minutes</option>
            </select>
            <span className="text-gray-400">
              Current: {formatDelay(formData.processing_delay_ms ?? config.processing_delay_ms ?? 60000)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Delay between processing each news item. Prevents burst AI API usage.
            Higher values reduce cost but slow down market generation.
          </p>
        </section>

        {/* Rate Limits */}
        <section className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Rate Limits</h2>

          {/* AI Auto-Publish Limit - Highlighted */}
          <div className="mb-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
            <label className="block text-sm font-medium text-blue-300 mb-1">
              AI Auto-Publish per Hour
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                value={formData.rate_limits?.auto_publish_per_hour ?? config.rate_limits.auto_publish_per_hour ?? 3}
                onChange={(e) => handleRateLimitChange('auto_publish_per_hour', parseInt(e.target.value))}
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
              <span className="text-gray-400">markets/hour</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Maximum AI-generated markets published per hour. Set to 0 to disable auto-publishing.
              User proposals are not affected by this limit.
            </p>
          </div>

          <h3 className="text-sm font-medium text-gray-300 mb-3">User Rate Limits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Proposals per minute</label>
              <input
                type="number"
                min="1"
                value={formData.rate_limits?.propose_per_minute ?? config.rate_limits.propose_per_minute}
                onChange={(e) => handleRateLimitChange('propose_per_minute', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Proposals per hour</label>
              <input
                type="number"
                min="1"
                value={formData.rate_limits?.propose_per_hour ?? config.rate_limits.propose_per_hour}
                onChange={(e) => handleRateLimitChange('propose_per_hour', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Proposals per day</label>
              <input
                type="number"
                min="1"
                value={formData.rate_limits?.propose_per_day ?? config.rate_limits.propose_per_day}
                onChange={(e) => handleRateLimitChange('propose_per_day', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Disputes per hour</label>
              <input
                type="number"
                min="1"
                value={formData.rate_limits?.dispute_per_hour ?? config.rate_limits.dispute_per_hour}
                onChange={(e) => handleRateLimitChange('dispute_per_hour', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Disputes per day</label>
              <input
                type="number"
                min="1"
                value={formData.rate_limits?.dispute_per_day ?? config.rate_limits.dispute_per_day}
                onChange={(e) => handleRateLimitChange('dispute_per_day', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Enabled Categories</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((category) => {
              const isEnabled = (formData.categories || config.categories).includes(category);
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryToggle(category)}
                  className={`px-3 py-1.5 rounded text-sm capitalize transition-colors ${
                    isEnabled
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {category.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
