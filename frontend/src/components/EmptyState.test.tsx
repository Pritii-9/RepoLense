import { render } from '@testing-library/react'

import { EmptyState } from '@/components/EmptyState'

describe('EmptyState', () => {
  it('shows the title and description passed by the page', () => {
    const { getByRole, getByText } = render(
      <EmptyState
        title="No reports yet"
        description="Run one repository analysis to see results here."
      />,
    )

    expect(getByRole('heading', { name: 'No reports yet' })).toBeInTheDocument()
    expect(getByText('Run one repository analysis to see results here.')).toBeInTheDocument()
  })
})
