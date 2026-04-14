import type { View } from 'react-native'
import { captureView } from '../src/overlay/captureView'

const { makeImageFromView } = require('@shopify/react-native-skia')

const mockRef = (current: unknown = {}) => ({ current }) as unknown as React.RefObject<View | null>

describe('captureView', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns CPU-backed SkImage when capture succeeds', async () => {
    const ref = mockRef()
    const result = await captureView(ref)
    expect(result).not.toBeNull()
    expect(makeImageFromView).toHaveBeenCalledWith(ref)
  })

  it('returns null when makeImageFromView returns null', async () => {
    makeImageFromView.mockResolvedValueOnce(null)
    const result = await captureView(mockRef())
    expect(result).toBeNull()
  })

  it('returns null when makeImageFromView throws', async () => {
    makeImageFromView.mockRejectedValueOnce(new Error('crash'))
    const result = await captureView(mockRef())
    expect(result).toBeNull()
  })
})
