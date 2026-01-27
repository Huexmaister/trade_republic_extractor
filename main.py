import json
import os
import datetime
from typing import List, Literal

import pandas as pd
from constants_and_tools import ConstantsAndTools
from app.data_classes import Active, Operation, BuyOperation, SellOperation
import pprint

class Main:
    def __init__(self):
        self.CT: ConstantsAndTools = ConstantsAndTools()
        with open('data/input_data/extracto_ines.json', 'r', encoding='utf-8') as f:
            self.extracto: dict = json.load(f)

        # -- Lista que va a contener los diferentes activos
        self.actives_list: List[Active] = []

        # -- Listas de restricciones
        self.allowed_types: List[str] = ["Operar"]
        self.excluded_initial_isin: List[str] = ["XF"]

        # -- Itero por cada fila del extracto
        for elem in self.extracto:
            elem_str_date: str = elem["date_iso"]
            elem_type: str = elem["type"]
            elem_description: str = elem["description"]
            elem_isin: str = elem["isin"]
            elem_name: str = elem["name"]
            elem_quantity: float = elem["quantity"]
            elem_incoming_amount: float = elem["incoming_amount"]
            elem_outgoing_amount: float = elem["outgoing_amount"]

            # -- Aplico restricciones
            if elem_type not in self.allowed_types:
                continue
            
            # Corrección: elem_isin.startswith espera una tupla o string, no "self.excluded_initial_isin" como string literal
            # Además, excluded_initial_isin es una lista, así que iteramos o usamos tupla
            if any(elem_isin.startswith(prefix) for prefix in self.excluded_initial_isin):
                continue

            # -- Defino si es compra o venta
            # Nota: incoming_amount > 0 suele ser venta (entra dinero), outgoing_amount > 0 suele ser compra (sale dinero)
            # El código original tenía: elem_buy_or_sell = 'buy' if elem_outgoing_amount > 0 else 'sell'
            # Asumimos que outgoing_amount es positivo en compras.
            
            # amount para pasar al metodo add_operation
            amount = elem_outgoing_amount if elem_outgoing_amount > 0 else elem_incoming_amount

            # Buscamos si el activo ya existe en la lista
            active_found = None
            for active in self.actives_list:
                if active.isin == elem_isin:
                    active_found = active
                    break
            
            # Si no existe, lo creamos
            if not active_found:
                # Si es una venta y no existe el activo, podría ser un error de datos o una venta en corto (no soportada explícitamente pero la creamos igual)
                # O simplemente es la primera operación y es una compra.
                active_found = Active(isin=elem_isin, name=elem_name)
                self.actives_list.append(active_found)
            
            # Agregamos la operación al activo encontrado o recién creado
            # El metodo add_operation ya se encarga de crear BuyOperation o SellOperation internamente
            # y de actualizar current_qty
            active_found.add_operation(
                isin=elem_isin,
                str_date=elem_str_date,
                description=elem_description,
                qty=elem_quantity,
                amount=amount
            )

        # -- Una vez procesadas todas las operaciones, calculamos FIFO para cada activo
        for active in self.actives_list:
            active.calculate_fifo()
            active.print_fifo_report()

    def export_to_json(self):
        """
        Exporta la lista de activos a un archivo JSON.
        """
        output_dir = "data/output_data"
        os.makedirs(output_dir, exist_ok=True)
        
        today_str = datetime.date.today().isoformat()
        file_path = os.path.join(output_dir, f"{today_str}.json")
        
        data_to_export = [active.to_dict() for active in self.actives_list]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data_to_export, f, indent=4, ensure_ascii=False)
            
        print(f"Datos exportados correctamente a: {file_path}")

    def export_sales_history(self):
        """
        Obtiene todos los sales details de cada activo, los unifica en una lista,
        los ordena por fecha descendente y los exporta a un JSON.
        """
        output_dir = "data/output_data"
        os.makedirs(output_dir, exist_ok=True)

        all_sales = []

        for active in self.actives_list:
            for detail in active.sales_details:
                # Construimos un diccionario plano con la info del activo y el detalle serializado
                sale_entry = {
                    "active_name": active.name,
                    "active_isin": active.isin,
                    # Usamos la fecha de la venta para ordenar
                    "sell_date": detail['sell_operation'].str_date,
                    "sell_operation": detail['sell_operation'].to_dict(),
                    "gross_profit": detail['gross_profit'],
                    "net_profit": detail['net_profit'],
                    "comissions": detail['comissions'],
                    "taxes": detail['taxes'],
                    "matched_buys": [
                        {
                            "buy_operation": match["buy_operation"].to_dict(),
                            "matched_qty": match["matched_qty"],
                            "buy_price": match["buy_price"]
                        }
                        for match in detail["matched_buys"]
                    ]
                }
                all_sales.append(sale_entry)

        # Ordenamos la lista por fecha descendente (más reciente primero)
        all_sales.sort(key=lambda x: x['sell_date'], reverse=True)

        # Generamos el nombre del archivo con datetime.now
        now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        file_path = os.path.join(output_dir, f"ventas_historicas_{now_str}.json")

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(all_sales, f, indent=4, ensure_ascii=False)

        print(f"Histórico de ventas exportado correctamente a: {file_path}")


if __name__ == "__main__":
    main = Main()
    main.export_to_json()
    main.export_sales_history()
