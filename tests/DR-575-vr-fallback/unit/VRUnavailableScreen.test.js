/**
 * @jest-environment jsdom
 */

/**
 * VRUnavailableScreen Component Tests
 * DR-575: VR Fallback Screen
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VRUnavailableScreen from '../../../../dreamscape-frontend/panorama/src/components/VRUnavailableScreen';

describe('VRUnavailableScreen (DR-575)', () => {
  const defaultProps = {
    xrReason: 'no-webxr-api',
    onSwitchToGallery: jest.fn(),
    onSwitchTo3D: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays correct message for no-webxr-api', () => {
    render(<VRUnavailableScreen {...defaultProps} xrReason="no-webxr-api" />);

    expect(screen.getByText('Navigateur non compatible WebXR')).toBeInTheDocument();
    expect(screen.getByText(/ne supporte pas la réalité virtuelle/)).toBeInTheDocument();
  });

  it('displays correct message for no-headset', () => {
    render(<VRUnavailableScreen {...defaultProps} xrReason="no-headset" />);

    expect(screen.getByText('Casque VR non détecté')).toBeInTheDocument();
    expect(screen.getByText(/Aucun casque de réalité virtuelle/)).toBeInTheDocument();
  });

  it('displays correct message for error', () => {
    render(<VRUnavailableScreen {...defaultProps} xrReason="error" />);

    expect(screen.getByText('Erreur de détection VR')).toBeInTheDocument();
    expect(screen.getByText(/erreur est survenue/)).toBeInTheDocument();
  });

  it('calls onSwitchToGallery when gallery button is clicked', () => {
    const onSwitchToGallery = jest.fn();
    render(<VRUnavailableScreen {...defaultProps} onSwitchToGallery={onSwitchToGallery} />);

    fireEvent.click(screen.getByLabelText('Explorer en mode Galerie 2D'));

    expect(onSwitchToGallery).toHaveBeenCalledTimes(1);
  });

  it('calls onSwitchTo3D when 3D button is clicked', () => {
    const onSwitchTo3D = jest.fn();
    render(<VRUnavailableScreen {...defaultProps} onSwitchTo3D={onSwitchTo3D} />);

    fireEvent.click(screen.getByLabelText('Voir en mode 3D interactif'));

    expect(onSwitchTo3D).toHaveBeenCalledTimes(1);
  });

  it('renders the DreamScape logo', () => {
    render(<VRUnavailableScreen {...defaultProps} />);

    expect(screen.getByText('DreamScape')).toBeInTheDocument();
  });

  it('renders help section', () => {
    render(<VRUnavailableScreen {...defaultProps} />);

    expect(screen.getByText('Comment activer la VR ?')).toBeInTheDocument();
  });

  it('has accessible button labels', () => {
    render(<VRUnavailableScreen {...defaultProps} />);

    expect(screen.getByLabelText('Explorer en mode Galerie 2D')).toBeInTheDocument();
    expect(screen.getByLabelText('Voir en mode 3D interactif')).toBeInTheDocument();
  });
});
