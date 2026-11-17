import React from 'react';
import { InteriorDesigner3D } from '../components/InteriorDesigner3D';

interface InteriorDesignerPageProps {
  querySearch: string;
  onNavigate: (path: string) => void;
}

export function InteriorDesignerPage({ querySearch, onNavigate }: InteriorDesignerPageProps) {
  const params = new URLSearchParams(querySearch || window.location.search);
  const rawProp = params.get('propertyId');
  const propertyId = rawProp && !Number.isNaN(Number(rawProp)) ? Number(rawProp) : undefined;

  return (
    <InteriorDesigner3D
      propertyId={propertyId}
      onClose={() => onNavigate('/catalog')}
    />
  );
}
