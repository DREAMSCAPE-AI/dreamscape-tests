/**
 * @jest-environment jsdom
 */

/**
 * PanoramaGallery Component Tests
 * DR-575: 2D Gallery Mode
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PanoramaGallery from '../../../../dreamscape-frontend/panorama/src/components/PanoramaGallery';

// Mock the environments module
jest.mock('../../../../dreamscape-frontend/panorama/src/data/environments', () => ({
  listVREnvironments: () => [
    { id: 'paris', name: 'Paris', description: 'Ville Lumière', sceneCount: 3, defaultScene: 'eiffel-tower' },
    { id: 'barcelona', name: 'Barcelona', description: 'Ville Catalane', sceneCount: 2, defaultScene: 'sagrada' },
  ],
  VR_ENVIRONMENTS: {
    paris: {
      name: 'Paris',
      description: 'Ville Lumière',
      scenes: [
        { id: 'eiffel-tower', name: 'Tour Eiffel', description: 'Vue du Champ de Mars', icon: '🗼', panoramaUrl: '/paris/eiffel.jpg', thumbnailUrl: '/paris/thumb-eiffel.jpg' },
        { id: 'louvre', name: 'Musée du Louvre', description: 'La pyramide', icon: '🏛️', panoramaUrl: '/paris/louvre.jpg', thumbnailUrl: '/paris/thumb-louvre.jpg' },
        { id: 'sacre-coeur', name: 'Sacré-Cœur', description: 'Montmartre', icon: '⛪', panoramaUrl: '/paris/sacre-coeur.jpg', thumbnailUrl: '/paris/thumb-sacre.jpg' },
      ],
    },
    barcelona: {
      name: 'Barcelona',
      description: 'Ville Catalane',
      scenes: [
        { id: 'sagrada', name: 'Sagrada Família', description: 'Basilique de Gaudí', icon: '⛪', panoramaUrl: '/bcn/sagrada.jpg', thumbnailUrl: '/bcn/thumb-sagrada.jpg' },
        { id: 'park-guell', name: 'Park Güell', description: 'Parc de Gaudí', icon: '🏞️', panoramaUrl: '/bcn/guell.jpg', thumbnailUrl: '/bcn/thumb-guell.jpg' },
      ],
    },
  },
}));

describe('PanoramaGallery (DR-575)', () => {
  const defaultProps = {
    onSwitchToVR: jest.fn(),
    onSwitchTo3D: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the gallery header', () => {
    render(<PanoramaGallery {...defaultProps} />);

    expect(screen.getByText('DreamScape')).toBeInTheDocument();
    expect(screen.getByText('Explorez nos destinations')).toBeInTheDocument();
  });

  it('displays all destinations in the grid', () => {
    render(<PanoramaGallery {...defaultProps} />);

    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
  });

  it('shows scene count badges', () => {
    render(<PanoramaGallery {...defaultProps} />);

    expect(screen.getByText('3 panoramas')).toBeInTheDocument();
    expect(screen.getByText('2 panoramas')).toBeInTheDocument();
  });

  it('opens panorama viewer when a destination card is clicked', () => {
    render(<PanoramaGallery {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Explorer Paris'));

    // Scene name appears in overlay + thumbnail strip, so use getAllByText
    expect(screen.getAllByText(/Tour Eiffel/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('navigates to next scene', () => {
    render(<PanoramaGallery {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Explorer Paris'));
    fireEvent.click(screen.getByLabelText('Scène suivante'));

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('navigates to previous scene', () => {
    render(<PanoramaGallery {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Explorer Paris'));
    // Go to last scene (wraps around)
    fireEvent.click(screen.getByLabelText('Scène précédente'));

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('returns to grid when back button is clicked', () => {
    render(<PanoramaGallery {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Explorer Paris'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Retour aux destinations'));

    // Back to grid
    expect(screen.getByText('Explorez nos destinations')).toBeInTheDocument();
  });

  it('calls onSwitchToVR when VR button is clicked', () => {
    const onSwitchToVR = jest.fn();
    render(<PanoramaGallery {...defaultProps} onSwitchToVR={onSwitchToVR} />);

    fireEvent.click(screen.getByLabelText('Retour en mode VR'));

    expect(onSwitchToVR).toHaveBeenCalledTimes(1);
  });

  it('calls onSwitchTo3D when 3D button is clicked', () => {
    const onSwitchTo3D = jest.fn();
    render(<PanoramaGallery {...defaultProps} onSwitchTo3D={onSwitchTo3D} />);

    fireEvent.click(screen.getByLabelText('Mode 3D interactif'));

    expect(onSwitchTo3D).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard navigation (ArrowRight)', () => {
    render(<PanoramaGallery {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Explorer Paris'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('supports keyboard navigation (ArrowLeft)', () => {
    render(<PanoramaGallery {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Explorer Paris'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('supports Escape key to return to grid', () => {
    render(<PanoramaGallery {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Explorer Paris'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Explorez nos destinations')).toBeInTheDocument();
  });

  // === Tests avec destination fixée (mode ?destination=paris) ===

  it('starts directly on scenes when destination prop is provided', () => {
    render(<PanoramaGallery {...defaultProps} destination="paris" />);

    // Should show Paris scenes directly, not the grid
    expect(screen.getAllByText(/Tour Eiffel/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    // Grid title should NOT be visible
    expect(screen.queryByText('Explorez nos destinations')).not.toBeInTheDocument();
  });

  it('does not show back button when destination is locked', () => {
    render(<PanoramaGallery {...defaultProps} destination="paris" />);

    expect(screen.queryByLabelText('Retour aux destinations')).not.toBeInTheDocument();
  });

  it('Escape does not return to grid when destination is locked', () => {
    render(<PanoramaGallery {...defaultProps} destination="paris" />);

    expect(screen.getAllByText(/Tour Eiffel/).length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: 'Escape' });

    // Should still show the scene, not the grid
    expect(screen.getAllByText(/Tour Eiffel/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Explorez nos destinations')).not.toBeInTheDocument();
  });

  it('navigates between scenes with locked destination', () => {
    render(<PanoramaGallery {...defaultProps} destination="paris" />);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Scène suivante'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });
});
