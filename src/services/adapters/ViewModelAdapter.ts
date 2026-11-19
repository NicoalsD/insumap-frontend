/**
 * Converts a validated API DTO into the view model a screen renders. Screens never read DTOs:
 * they read what an adapter returns, so a contract change touches one class.
 *
 * Pattern: P06 Adapter
 */
export interface ViewModelAdapter<Dto, ViewModel> {
  adapt(dto: Dto): ViewModel;
}

/** Adapts every element of a list with the same adapter. */
export function adaptAll<Dto, ViewModel>(
  adapter: ViewModelAdapter<Dto, ViewModel>,
  dtos: readonly Dto[],
): readonly ViewModel[] {
  return dtos.map((dto) => adapter.adapt(dto));
}
