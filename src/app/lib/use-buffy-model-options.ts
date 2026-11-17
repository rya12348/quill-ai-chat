import { useMemo } from 'react'

import { useModels, useProviders } from './api'
import { selectableBuffyModels } from './buffy-model-health'

/** The free models the picker may show right now. */
export function useBuffyModelOptions() {
  const providers = useProviders()
  const catalogue = useModels()
  const options = useMemo(
    () => selectableBuffyModels(providers.data?.items, catalogue.data?.items),
    [providers.data, catalogue.data],
  )
  return {
    options,
    loading: providers.isLoading || catalogue.isLoading,
  }
}
