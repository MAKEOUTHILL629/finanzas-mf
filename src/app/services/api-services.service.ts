

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';



@Injectable({
  providedIn: 'root'
})
export class ApiServicesService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Realiza una petición GET
   * @param endpoint El endpoint de la API
   * @param params Parámetros opcionales de la consulta
   * @returns Observable con la respuesta
   */
  get<T>(endpoint: string, params?: any): Observable<T> {
    const options = { params: new HttpParams({ fromObject: params }) };
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, options);
  }

  /**
   * Realiza una petición POST
   * @param endpoint El endpoint de la API
   * @param body El cuerpo de la petición
   * @returns Observable con la respuesta
   */
  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, body);
  }

  /**
   * Realiza una petición PUT
   * @param endpoint El endpoint de la API
   * @param body El cuerpo de la petición
   * @returns Observable con la respuesta
   */
  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${endpoint}`, body);
  }

  /**
   * Realiza una petición DELETE
   * @param endpoint El endpoint de la API
   * @returns Observable con la respuesta
   */
  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}/${endpoint}`);
  }

  /**
   * Realiza una petición PATCH
   * @param endpoint El endpoint de la API
   * @param body El cuerpo de la petición
   * @returns Observable con la respuesta
   */
  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.apiUrl}/${endpoint}`, body);
  }

  /**
   * Realiza una petición GET para obtener una lista paginada
   * @param endpoint El endpoint de la API
   * @param page El número de página
   * @param pageSize El tamaño de la página
   * @param params Parámetros adicionales opcionales
   * @returns Observable con la respuesta paginada
   */
  getPagedList<T>(endpoint: string, page: number, pageSize: number, params?: any): Observable<T> {
    const options = {
      params: new HttpParams({
        fromObject: {
          ...params,
          page: page.toString(),
          pageSize: pageSize.toString()
        }
      })
    };
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, options);
  }

  /**
   * Sube un archivo
   * @param endpoint El endpoint de la API
   * @param file El archivo a subir
   * @param params Parámetros adicionales opcionales
   * @returns Observable con la respuesta
   */
  uploadFile<T>(endpoint: string, file: File, params?: any): Observable<T> {
    const formData: FormData = new FormData();
    formData.append('file', file, file.name);

    if (params) {
      Object.keys(params).forEach(key => {
        formData.append(key, params[key]);
      });
    }

    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, formData);
  }

  /**
   * Sube un archivo FormData y recibe un archivo como respuesta
   * @param endpoint El endpoint de la API
   * @param formData El FormData con el archivo
   * @returns Observable con el Blob de respuesta
   */
  postFile(endpoint: string, formData: FormData): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/${endpoint}`, formData, {
      responseType: 'blob'
    });
  }
}
