import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginate } from './gitea';
import { HttpResponse } from 'gitea-js';

describe('paginate', () => {
  let mockRequest: (page: number) => Promise<HttpResponse<any[], any>>;

  beforeEach(() => {
    mockRequest = vi.fn();
  });

  it('should handle pagination when all data is retrieved in a single request', async () => {
    const data = [{ id: 1 }, { id: 2 }];
    const headers = new Headers({ 'x-total-count': '2' });

    mockRequest.mockResolvedValueOnce({
      data,
      headers,
    });

    const result = await paginate(mockRequest);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(result).toEqual(data);
  });

  it('should handle pagination when multiple requests are needed', async () => {
    const dataPage1 = [{ id: 1 }, { id: 2 }];
    const dataPage2 = [{ id: 3 }, { id: 4 }];
    const headers = new Headers({ 'x-total-count': '4' });

    mockRequest
      .mockResolvedValueOnce({
        data: dataPage1,
        headers,
      })
      .mockResolvedValueOnce({
        data: dataPage2,
        headers,
      });

    const result = await paginate(mockRequest);

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(result).toEqual([...dataPage1, ...dataPage2]);
  });

  it('should throw an error if the x-total-count header is missing', async () => {
    mockRequest.mockResolvedValueOnce({
      data: [],
      headers: new Headers(),
    });

    await expect(paginate(mockRequest)).rejects.toThrow(
      "Header 'x-total-count' not found"
    );
  });
});
