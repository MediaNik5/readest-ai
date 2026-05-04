import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { FiPlus, FiBookOpen } from 'react-icons/fi';
import { IoSparklesOutline } from 'react-icons/io5';
import { useTranslation } from '@/hooks/useTranslation';
import { listSeries, createSeries, type Series } from '@/services/sofusion/api';

export interface SeriesSelection {
  seriesId: number | null;
  seriesOrder: number | null;
  seriesName?: string;
}

interface SofusionSeriesSelectorProps {
  value: SeriesSelection;
  onChange: (selection: SeriesSelection) => void;
  disabled?: boolean;
  error?: string | null;
  suggestedOrder?: number;
}

const SofusionSeriesSelector: React.FC<SofusionSeriesSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  error = null,
  suggestedOrder,
}) => {
  const _ = useTranslation();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    setIsLoading(true);
    try {
      const series = await listSeries();
      setSeriesList(series);
    } catch (err) {
      console.error('Failed to load series:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeriesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const seriesId = e.target.value === 'none' ? null : Number(e.target.value);
    const selectedSeries = seriesList.find((s) => s.id === seriesId);
    onChange({
      seriesId,
      seriesOrder: seriesId ? value.seriesOrder || suggestedOrder || 1 : null,
      seriesName: selectedSeries?.name,
    });
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const order = e.target.value === '' ? null : Number(e.target.value);
    onChange({ ...value, seriesOrder: order });
  };

  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) {
      setCreateError(_('Series name is required'));
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createSeries({
        name: newSeriesName.trim(),
        description: newSeriesDescription.trim() || undefined,
      });

      setSeriesList([...seriesList, result]);
      onChange({
        seriesId: result.id,
        seriesOrder: 1,
        seriesName: result.name,
      });

      setShowCreateSeries(false);
      setNewSeriesName('');
      setNewSeriesDescription('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : _('Failed to create series'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IoSparklesOutline className="text-primary h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">{_('Series (Optional)')}</span>
      </div>

      <div className="flex flex-col gap-2">
        <select
          value={value.seriesId ?? 'none'}
          onChange={handleSeriesChange}
          disabled={disabled || isLoading}
          className={clsx(
            'select select-bordered select-sm w-full',
            disabled && 'select-disabled',
          )}
        >
          <option value="none">{_('No Series (Standalone)')}</option>
          {isLoading ? (
            <option disabled>{_('Loading...')}</option>
          ) : (
            seriesList.map((series) => (
              <option key={series.id} value={series.id}>
                {series.name}
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          onClick={() => setShowCreateSeries(!showCreateSeries)}
          disabled={disabled}
          className="btn btn-ghost btn-xs w-fit gap-1 px-2 text-primary"
        >
          <FiPlus className="h-3 w-3" />
          {showCreateSeries ? _('Cancel') : _('Create New Series')}
        </button>
      </div>

      {showCreateSeries && (
        <div className="bg-base-200 rounded-lg p-3">
          <div className="mb-3">
            <label className="text-base-content/70 mb-1 block text-xs font-medium">
              {_('Series Name')} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={newSeriesName}
              onChange={(e) => setNewSeriesName(e.target.value)}
              placeholder={_('e.g., Harry Potter')}
              className="input input-bordered input-sm w-full"
              disabled={isCreating}
              maxLength={100}
            />
          </div>

          <div className="mb-3">
            <label className="text-base-content/70 mb-1 block text-xs font-medium">
              {_('Description')}
            </label>
            <textarea
              value={newSeriesDescription}
              onChange={(e) => setNewSeriesDescription(e.target.value)}
              placeholder={_('Optional description of the series...')}
              className="textarea textarea-bordered textarea-sm w-full min-h-[60px] resize-y"
              disabled={isCreating}
              maxLength={500}
            />
          </div>

          {createError && (
            <div className="alert alert-error mb-3 py-2 text-xs">
              <span>{createError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateSeries}
            disabled={isCreating || !newSeriesName.trim()}
            className="btn btn-primary btn-sm w-full"
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                {_('Creating...')}
              </>
            ) : (
              <>
                <FiBookOpen className="h-3 w-3" />
                {_('Create Series')}
              </>
            )}
          </button>
        </div>
      )}

      {value.seriesId !== null && (
        <div>
          <label className="text-base-content/70 mb-1 block text-xs font-medium">
            {_('Book Number in Series')}
          </label>
          <input
            type="number"
            min="1"
            value={value.seriesOrder ?? ''}
            onChange={handleOrderChange}
            disabled={disabled}
            placeholder={suggestedOrder ? String(suggestedOrder) : '1'}
            className="input input-bordered input-sm w-full"
          />
          <p className="text-base-content/50 mt-1 text-[10px]">
            {_('The order of this book within the series (1, 2, 3...)')}
          </p>
        </div>
      )}

      {error && (
        <div className="alert alert-error py-2 text-xs">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default SofusionSeriesSelector;
