import { Suspense } from 'react';
import Vehicle3DModelInternal from '@/components/Vehicle3DModel';
import type { ComponentProps } from 'react';

export interface Vehicle3DModelProps extends ComponentProps<typeof Vehicle3DModelInternal> {}

/**
 * Safe wrapper around Vehicle3DModel that handles initialization safely.
 * This component ensures proper React context is available for hooks.
 */
export const Vehicle3DModel = (props: Vehicle3DModelProps) => {
  return (
    <Suspense
      fallback={
        <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading 3D view...</p>
          </div>
        </div>
      }
    >
      <Vehicle3DModelInternal {...props} />
    </Suspense>
  );
};

export default Vehicle3DModel;
