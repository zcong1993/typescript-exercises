// This enabled module augmentation mode.
import 'date-wizard'

declare module 'date-wizard' {
  // Add your module extensions here.
  export function pad(n: number): string
  export interface DateDetails {
    hours: number
  }
}
